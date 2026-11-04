const mongoose = require('mongoose');
const { Schema, model } = mongoose;

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 4, maxlength: 30 },
  password: { type: String, required: true },
});

const UserModel = model('User', UserSchema);

module.exports = UserModel;
