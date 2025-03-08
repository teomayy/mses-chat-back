const { connect } = require('getstream')
const bcrypt = require('bcrypt')
const StreamChat = require('stream-chat').StreamChat
const crypto = require('crypto')
const redis = require('redis')
const axios = require('axios')

require('dotenv').config()

const api_key = process.env.STREAM_API_KEY
const api_secret = process.env.STREAM_API_SECRET
const app_id = process.env.STREAM_APP_ID
const ESKIZ_EMAIL = process.env.ESKIZ_EMAIL
const ESKIZ_PASSWORD = process.env.ESKIZ_PASSWORD

const redisClient = redis.createClient()

redisClient.on('connect', () => {
	console.log('Connected to Redis12345')
})

redisClient.on('error', err => {
	console.log(err.message)
})

redisClient.on('ready', () => {
	console.log('Redis is ready')
})

redisClient.on('end', () => {
	console.log('Redis connection ended')
})

process.on('SIGINT', () => {
	redisClient.quit()
})

redisClient
	.connect()
	.then(() => {
		console.log('Connected to Redis')
	})
	.catch(err => {
		console.log(err.message)
	})

// const accountSid = process.env.TWILIO_ACCOUNT_SID
// const authToken = process.env.TWILIO_AUTH_TOKEN
// const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID

const login = async (req, res) => {
	try {
		const { username, password } = req.body

		const serverClient = connect(api_key, api_secret, app_id)

		const client = StreamChat.getInstance(api_key, api_secret)

		const { users } = await client.queryUsers({ name: username })

		if (!users.length)
			return res.status(400).json({ message: 'Пользователь не найден' })

		const success = await bcrypt.compare(password, users[0].hashedPassword)

		const token = serverClient.createUserToken(users[0].id)

		if (success) {
			res.status(200).json({
				token,
				fullName: users[0].fullName,
				username,
				userId: users[0].id,
			})
		} else {
			res.status(500).json({ message: 'Неверный пароль' })
		}
	} catch (error) {
		res.status(500).json({ message: error })
	}
}

const signup = async (req, res) => {
	try {
		const { phoneNumber, username, fullName, password } = req.body

		const userId = crypto.randomBytes(16).toString('hex')

		const serverClient = connect(api_key, api_secret, app_id)

		const client = StreamChat.getInstance(api_key, api_secret)

		const existingUser = await client.queryUsers({ username })

		if (existingUser.users.length > 0) {
			return res
				.status(400)
				.json({ success: false, message: 'Имя пользователя уже существует' })
		}

		const hashedPassword = await bcrypt.hash(password, 10)

		const token = serverClient.createUserToken(userId)

		await client.upsertUser({
			id: userId,
			name: username,
			hashedPassword,
			phoneNumber,
			fullName,
		})

		res
			.status(200)
			.json({ token, fullName, username, userId, hashedPassword, phoneNumber })
	} catch (error) {
		res.status(500).json({ message, error })
	}
}

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000))

const getEskizToken = async () => {
	try {
		let token = await redisClient.get('eskiz_auth_token')
		if (!token) {
			token = await refreshEskizToken()
		}
		return token
	} catch (error) {
		console.error('Ошибка получения Eskiz-токена:', error)
		throw new Error('Ошибка получения Eskiz-токена')
	}
}

const refreshEskizToken = async () => {
	try {
		const response = await axios.patch(
			'https://notify.eskiz.uz/api/auth/refresh',
			{},
			{
				headers: {
					Authorization: `Bearer ${process.env.ESKIZ_AUTH_TOKEN}`,
				},
			}
		)
		const newToken = response.data.data.token
		process.env.ESKIZ_AUTH_TOKEN = newToken

		await redisClient.setEx('eskiz_auth_token', 29 * 24 * 60 * 60, newToken)

		console.log('Eskiz token обновлён:', newToken)
		return newToken
	} catch (error) {
		console.error(
			'Ошибка при обновлении токена Eskiz',
			error.response?.data || error
		)
		return await generateNewEskizToken()
	}
}

const generateNewEskizToken = async () => {
	try {
		const response = await axios.post(
			'https://notify.eskiz.uz/api/auth/login',
			new URLSearchParams({
				email: process.env.ESKIZ_EMAIL,
				password: process.env.ESKIZ_PASSWORD,
			}),
			{
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			}
		)
		const newToken = response.data.data.token
		process.env.ESKIZ_AUTH_TOKEN = newToken

		await redisClient.setEx('eskiz_auth_token', 29 * 24 * 60 * 60, newToken)
		console.log('Новый Eskiz token получен:', newToken)
		return newToken
	} catch (error) {
		console.error(
			'Ошибка при получении нового токена Eskiz',
			error.response?.data || error
		)
		throw new Error('Не удалось получить новый токен Eskiz')
	}
}

const sendOtp = async (req, res) => {
	const { phoneNumber } = req.body
	const otp = generateOtp()
	try {
		await redisClient.setEx(phoneNumber, 300, otp)

		const message = `Код подтверждения для регистрации на сайте mses-chat.uz: ${otp}`

		let token = await getEskizToken()

		const client = StreamChat.getInstance(api_key, api_secret)

		const filter = Number(phoneNumber)
		const existingUser = await client.queryUsers({
			phoneNumber: filter,
		})

		console.log('tel-1', existingUser.users)
		if (existingUser.users.length > 0) {
			return res
				.status(400)
				.json({ success: false, message: 'Номер телефона уже зарегистрирован' })
		}

		const response = await axios.post(
			'https://notify.eskiz.uz/api/message/sms/send',
			new URLSearchParams({
				mobile_phone: phoneNumber,
				message: message,
				from: 'mses',
			}),
			{
				'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
				headers: { Authorization: `Bearer ${token}` },
			}
		)
		res.status(200).send({ success: true, message: 'Код успешно отправлен' })

		// const templateData = {
		// 	name: 'VerificationCode',
		// 	content: message,
		// }

		// const templateResponse = await axios.post(
		// 	'https://notify.eskiz.uz/api/user/template',
		// 	templateData,
		// 	{
		// 		headers: {
		// 			Authorization: `Bearer ${authToken}`,
		// 		},
		// 	}
		// )
		// console.log('Template submitted', templateResponse.data)
	} catch (error) {
		console.error('Ошибка при отправке', error)
		res.status(500).send({ success: false, message: 'Ошибка при отправке' })
	}
}

// async (err, storedOtp) => {
//
// }

const verifyOtp = async (req, res) => {
	const { phoneNumber, otp } = req.body
	try {
		const storedOtp = await redisClient.get(phoneNumber)
		// if (err) {
		// 	console.error('Redis error', err)
		// 	return res
		// 		.status(500)
		// 		.send({ success: false, message: 'Внутренняя ошибка сервера' })
		// }
		// console.log('OTP', storedOtp, otp)
		if (storedOtp === otp) {
			return res
				.status(200)
				.send({ success: true, message: 'OTP успешно подтвержден' })
		} else {
			return res.status(400).send({ success: false, message: 'Неверный OTP' })
		}
	} catch (error) {
		console.error('Ошибка при подтверждение', error)
		res
			.status(500)
			.send({ success: false, message: 'Ошибка при подтверждение' })
	}
}

const sendResetOtp = async (req, res) => {
	const { phoneNumber } = req.body
	const otp = generateOtp()
	try {
		const userExists = await checkUserExistsByPhone(phoneNumber)
		if (!userExists) {
			return res
				.status(400)
				.json({ message: 'Номер телефона не зарегистрирован' })
		}

		redisClient.setEx(phoneNumber, 300, otp)

		const message = `Восстановление пароля для платформы mses chat: ${otp}`

		let token = await getEskizToken()

		await axios.post(
			'https://notify.eskiz.uz/api/message/sms/send',
			new URLSearchParams({
				mobile_phone: phoneNumber,
				message: message,
				from: 'mses',
			}),
			{
				'Content-Type': 'application/x.www-form-urlencoded;charset=utf-8',
				headers: { Authorization: `Bearer ${token}` },
			}
		)
		res.status(200).send({ success: true, message: 'Код успешно отправлен' })
	} catch (error) {
		console.error('Ошибка при отправке', error)
		res.status(500).send({ success: false, message: 'Ошибка при отправке' })
	}
}

const resetPassword = async (req, res) => {
	const { phoneNumber, otp, newPassword } = req.body
	try {
		const storedOtp = await redisClient.get(phoneNumber)

		if (storedOtp !== otp) {
			console.log('lll', storedOtp, otp)
			return res.status(400).send({ success: false, message: 'Неверный OTP' })
		}
		const hashedPassword = await bcrypt.hash(newPassword, 10)
		await updatePasswordByPhone(phoneNumber, hashedPassword)
		res.status(200).send({ success: true, message: 'Пароль успешно сброшен' })
	} catch (error) {
		console.error('Ошибка при сбросе пароля')
	}
}

const checkUserExistsByPhone = async phoneNumber => {
	const client = StreamChat.getInstance(api_key, api_secret)
	const filter = Number(phoneNumber)
	const { users } = await client.queryUsers({ phoneNumber: filter })
	return users.length > 0
}

const updatePasswordByPhone = async (phoneNumber, newPassword) => {
	const client = StreamChat.getInstance(api_key, api_secret)
	const filter = Number(phoneNumber)
	const { users } = await client.queryUsers({ phoneNumber: filter })
	console.log(users)
	if (users.length > 0) {
		await client.partialUpdateUser({
			id: users[0].id,
			set: { hashedPassword: newPassword },
		})
	}
}

module.exports = {
	signup,
	login,
	sendOtp,
	verifyOtp,
	sendResetOtp,
	resetPassword,
	redisClient,
}
