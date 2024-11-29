const mongoose = require('mongoose');
const { Schema } = mongoose;

const PostSchema = new mongoose.Schema({
  title: { type: String},
  summary: { type: String},
  content: { type: String },
  cover: { type: String},
  author: { type: Schema.Types.ObjectId, ref: 'User'},
}, {
  timestamps: true, // Optional: Adds createdAt and updatedAt fields
});

const Post = mongoose.model('Post', PostSchema);
module.exports = Post;
