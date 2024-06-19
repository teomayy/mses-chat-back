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

const authToken = process.env.ESKIZ_AUTH_TOKEN

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
			res.status(200).json({ token, username, userId: users[0].id })
		} else {
			res.status(500).json({ message: 'Неверный пароль' })
		}
	} catch (error) {
		res.status(500).json({ message: error })
	}
}

const signup = async (req, res) => {
	try {
		const { phoneNumber, username, password } = req.body

		const userId = crypto.randomBytes(16).toString('hex')

		const serverClient = connect(api_key, api_secret, app_id)

		const hashedPassword = await bcrypt.hash(password, 10)

		const token = serverClient.createUserToken(userId)

		res
			.status(200)
			.json({ token, username, userId, hashedPassword, phoneNumber })
	} catch (error) {
		res.status(500).json({ message, error })
	}
}

const generateOtp = () => {
	return Math.floor(100000 + Math.random() * 900000).toString()
}

const sendOtp = async (req, res) => {
	const { phoneNumber } = req.body
	const otp = generateOtp()
	try {
		console.log('	PhoneNumber --', phoneNumber)
		redisClient.setEx(phoneNumber, 300, otp)

		const message = `Ваш код подтверждение для входа в mses-chat - ${otp}`

		const response = await axios.post(
			'https://notify.eskiz.uz/api/message/sms/send',
			new URLSearchParams({
				mobile_phone: phoneNumber,
				message: message,
				from: 'mses',
			}),
			{
				'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
				headers: { Authorization: `Bearer ${authToken}` },
			}
		)
		console.log('RRRRRR', response)
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

const verifyOtp = async (req, res) => {
	const { phoneNumber, otp } = req.body
	try {
		redisClient.get(phoneNumber, (err, storedOtp) => {
			if (err) {
				console.error('Redis error', err)
				return res
					.status(500)
					.send({ success: false, message: 'Внутренняя ошибка сервера' })
			}
			if (storedOtp === otp) {
				return res
					.status(200)
					.send({ success: true, message: 'OTP успешно подтвержден' })
			} else {
				return res.status(400).send({ success: true, message: 'Неверный OTP' })
			}
		})
	} catch (error) {
		console.error('Ошибка при подтверждение', error)
		res
			.status(500)
			.send({ success: false, message: 'Ошибка при подтверждение' })
	}
}

module.exports = { signup, login, sendOtp, verifyOtp, redisClient }
