const express = require('express')
require('dotenv').config()

const {
	signup,
	login,
	sendOtp,
	verifyOtp,
	uploadImage,
} = require('../controllers/auth.js')

const router = express.Router()

router.post('/send-otp', sendOtp)
router.post('/verify-otp', verifyOtp)
router.post('/signup', signup)
router.post('/login', login)

module.exports = router
