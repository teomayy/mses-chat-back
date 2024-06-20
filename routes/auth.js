const express = require('express')
require('dotenv').config()

const {
	signup,
	login,
	sendOtp,
	verifyOtp,
	sendResetOtp,
	resetPassword,
} = require('../controllers/auth.js')

const router = express.Router()

router.post('/send-otp', sendOtp)
router.post('/verify-otp', verifyOtp)
router.post('/signup', signup)
router.post('/login', login)
router.post('send-reset-otp', sendResetOtp)
router.post('reset-password', resetPassword)

module.exports = router
