const express = require('express')
const https = require('https')
const fs = require('fs')
const cors = require('cors')

const authRoutes = require('./routes/auth.js')

const app = express()
const PORT = process.env.PORT || 5000

require('dotenv').config()

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
const twilioClient = require('twilio')(accountSid, authToken)

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
	res.send('Hello, World!')
})

app.use('/auth', authRoutes)

app.post('/', (req, res) => {
	const { message, user: sender, type, members } = req.body

	if (type === 'message.new') {
		members
			.filter(member => member.user.id !== sender.id)
			.forEach(({ user }) => {
				if (!user.online) {
					twilioClient.messages
						.create({
							body: `У вас есть новое сообщение от ${message.user.username} - ${message.text}`,
							messagingServiceSid: messagingServiceSid,
							to: user.phoneNumber,
						})
						.then(() => console.log('Сообщение отправлен!'))
						.catch(err => console.log(err))
				}
			})
		return res.status(200).send('Сообщение отправлен!')
	}
	return res.status(200).send('Not a new message request')
})

const httpsOptions = {
	key: fs.readFileSync('./ryans-key.pem'),
	cert: fs.readFileSync('./ryans-cert.pem'),
}

const server = https.createServer(httpsOptions, (res, req) => {
	res.writeHead(200)
	res.end('Hello World!')
})

// server.listen(443)

app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
