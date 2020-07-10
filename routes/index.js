var express = require("express");
var router = express.Router();
var passport = require("passport");
var User = require("../models/user");
var Campground = require("../models/campground");
var Notification = require("../models/notification");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto"); //只有这个不需要被安装
var middleware = require("../middleware/index.js");
//这两行为了使用dotenv
const dotenv = require("dotenv")
dotenv.config()

router.get("/", function(req,res){
    res.render("landing");
})



//===============================================
//Authentication Routes
//===============================================
//show register form
router.get("/register", function(req,res){
    res.render("register",{page:"register"});   //page:regiester是在header里用的
})
//处理sign up logic
router.post("/register", function(req,res){
    var newUser = new User(
        {   //总体是为了做用户页面
            username: req.body.username, 
            firstname: req.body.firstName,
            lastname: req.body.lastName,
            email: req.body.email,
            avatar: req.body.avatar
        
        });

    //以下是注册一个新用户
    if(req.body.adminCode === "secretcode123") {  //判断这个注册的人知不知道超级管理员的密码
       newUser.isAdmin = true;
      
    }
    User.register(newUser, req.body.password, function(err,user){  //req.body.password是经过Hash的
       if(err){
           req.flash("error", err.message);
           return res.redirect("register");
       }
       passport.authenticate("local")(req,res,function(){  //验证通过直接登录
           req.flash("success","Welcome to yelpcamp! " + user.username);
           res.redirect("/campgrounds");//或者return res.render("register", {"error": err.message});
       })
    }); 
})
//show login form
router.get("/login", function(req,res){
    res.render("login",{page:"login"});  //page=login是在header.ejs里使用的
})
//处理login logic
router.post("/login", passport.authenticate("local",
        {
           successRedirect:"/campgrounds",
           failureRedirect: "/login"
        }
), function(req,res){

})

//===================add 登出route================//
router.get("/logout", function(req,res){
    req.logout();
    req.flash("success", "Logged you out");
    res.redirect("/campgrounds");
})

//======================忘记密码处理route================//
router.get("/forgot", function(req,res){
    res.render("forgot");
})
//从这开始到下面都是不太懂
router.post('/forgot', function(req, res, next) {
    async.waterfall([
        //设置token
      function(done) {
        crypto.randomBytes(20, function(err, buf) {
          var token = buf.toString('hex');
          done(err, token);  
        });
      },
      function(token, done) {
        User.findOne({ email: req.body.email }, function(err, user) {
          if (!user) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/forgot');
          }
  
          user.resetPasswordToken = token;
          user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  
          user.save(function(err) {
            done(err, token, user);
          });
        });
      },
      function(token, user, done) {
        var smtpTransport = nodemailer.createTransport({
          host:"smtp.163.com",
          secureConnection: true,
          port:465,
          sercure: true,
          auth: {
            user: 'forlearninguse999@163.com',
            pass: process.env.GMAILPW
          }
        });
        //收件人看到的信息格式
        var mailOptions = {
          to: user.email,
          from: 'forlearninguse999@163.com',
          subject: 'Node.js Password Reset',
          text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
            'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
            'http://' + req.headers.host + '/reset/' + token + '\n\n' +
            'If you did not request this, please ignore this email and your password will remain unchanged.\n'
        };
        smtpTransport.sendMail(mailOptions, function(err) {
          console.log('mail sent');
          req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
          done(err, 'done');
        });
      }
    ], function(err) {
      if (err) return next(err);
      res.redirect('/forgot');
    });
  });
  

  router.get('/reset/:token', function(req, res) {                              //大于
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
      if (!user) {
        req.flash('error', 'Password reset token is invalid or has expired.');
        return res.redirect('/forgot');
      }
      res.render('reset', {token: req.params.token});
    });
  });
  
  //写新password和储存新password的地方
  router.post('/reset/:token', function(req, res) {
    async.waterfall([  //waterfall是一组函数，挨个执行的函数数组
      function(done) {
        User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
          if (!user) {
            req.flash('error', 'Password reset token is invalid or has expired.');
            return res.redirect('back');
          }
          if(req.body.password === req.body.confirm) {
            user.setPassword(req.body.password, function(err) {
              user.resetPasswordToken = undefined;
              user.resetPasswordExpires = undefined;
              
              //更新用户信息
              user.save(function(err) {
                req.logIn(user, function(err) {
                  done(err, user);
                });
              });
            })
          } else {
              req.flash("error", "Passwords do not match.");
              return res.redirect('back');
          }
        });
      },
      function(user, done) {
        var smtpTransport = nodemailer.createTransport({
          host:"smtp.163.com",
          secureConnection: true,
          port:465,
          sercure: true,
          auth: {
            user: 'forlearninguse999@163.com',
            pass: process.env.GMAILPW
          }
        });
        var mailOptions = {
          to: user.email,
          from: 'forlearninguse999@163.com',
          subject: 'Your password has been changed',
          text: 'Hello,\n\n' +
            'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
        };
        smtpTransport.sendMail(mailOptions, function(err) {
          req.flash('success', 'Success! Your password has been changed.');
          done(err);
        });
      }
    ], function(err) {
      res.redirect('/campgrounds');
    });
  });

//====================User 资料展示页======================//

// user profile
router.get('/users/:id', async function(req, res) {
  try {
    let user = await User.findById(req.params.id).populate("followers").exec();
    Campground.find().where('author.id').equals(user._id).exec( function(err, campgrounds) {
      if(err) {
        req.flash("error", "Something went wrong.");
        res.redirect("/");
      }
      res.render("users/show", { user, campgrounds });
    })
  } catch(err) {
    req.flash("error", err.message);
    return res.redirect("back");
  }
});

//===============follow 页面=========================//
router.get('/follow/:id', middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.params.id);
    user.followers.push(req.user._id);
    user.save();
    req.flash('success', 'Successfully followed ' + user.username + '!');
    res.redirect('/users/' + req.params.id);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});
//=============查看所有信息提示==============//
// view all notifications
router.get('/notifications', middleware.isLoggedIn, async function(req, res) {
  try {
    let user = await User.findById(req.user._id).populate({
      path: 'notifications',
      options: { sort: { "_id": -1 } }
    }).exec();
    let allNotifications = user.notifications;
    res.render('notifications/index', { allNotifications });
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

// handle notification
router.get('/notifications/:id', middleware.isLoggedIn, async function(req, res) {
  try {
    let notification = await Notification.findById(req.params.id);
    notification.isRead = true;
    notification.save();
    res.redirect(`/campgrounds/${notification.campgroundId}`);
  } catch(err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

module.exports = router;