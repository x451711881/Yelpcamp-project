var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose"); //引入passport系统

var UserSchema = new mongoose.Schema({
   username: {type: String, unique: true, required: true},
   password: String,
   avatar: String,
   firstname: String,
   lastname: String,
   email: {type: String, unique: true, required: true},
   resetPasswordToken: String,
   resetPasswordExpires: Date,
   isAdmin:{type: Boolean, default:false},
   notifications: [
      {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Notification'
      }
   ],
   followers: [
      {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User'
      }
   ]


});

UserSchema.plugin(passportLocalMongoose); //给User模型加载methods
module.exports = mongoose.model("User", UserSchema);