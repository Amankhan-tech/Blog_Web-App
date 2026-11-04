const mongoose = require('mongoose');
const { Schema } = mongoose;

const PostSchema = new Schema({
  title: { type: String, required: true, maxlength: 200 },
  summary: { type: String, required: true, maxlength: 500 },
  content: { type: String, required: true },
  cover: { type: String, required: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

const Post = mongoose.model('Post', PostSchema);
module.exports = Post;
