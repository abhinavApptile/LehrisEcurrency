const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    otp: {
        required: true,
        type: Number,
    },
    date: {
        type: Date,
        default: Date.now()
    }
   
});

module.exports = Otps = mongoose.model("otps", otpSchema);