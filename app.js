var express = require("express");
    app = express();
    bodyParser = require("body-parser");
    mongoose = require("mongoose");
    flash = require("connect-flash"); //flash message 必须在引入passport之前用
    passport = require("passport");  //加入验证系统
    LocalStrategy = require("passport-local");
    methodOverride = require("method-override");
    Campground = require("./models/campground")
    Comment = require("./models/comment");
    User =  require("./models/user");
    Notification = require("./models/notification");
    seedDB = require("./seeds");
const dotenv = require("dotenv");
dotenv.config();
//have a try
var commentRoutes = require ("./routes/comments"); 
    reviewRoutes  = require("./routes/reviews");
    campgroundRoutes = require("./routes/campgrounds");
    indexRoutes = require("./routes/index"); //这个里面放的是authentication routes

//seedDB();
mongoose.connect('mongodb://localhost:27017/yelp_camp_v11',{useNewUrlParser: true, useUnifiedTopology: true});
app.use(bodyParser.urlencoded({extended: true}));
app.set("view engine", "ejs");
app.use(express.static(__dirname+"/public")); //__dirname是当前这个script直接所在的文件夹
app.use(methodOverride("_method")); //method override
app.use(flash());
app.locals.moment = require('moment');

//Passport Configuration  配置passport的使用环境
app.use(require("express-session")({
    secret:"Once upon a time!",
    resave:false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate())); //User认证程序来源于user model import的模块
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use( async function(req,res,next){
    res.locals.currentUser = req.user; //让所有routes的currentUser都变成req.user,不用手动每个route都手动加
     
                                      //req.user是passport自动创建的，存储username和userID
    
    //以下是做notifications需要的东西
    if(req.user) {
        try {
          let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
          res.locals.notifications = user.notifications.reverse();
        } catch(err) {
          console.log(err.message);
        }
       }
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
})


app.use(indexRoutes);
app.use("/campgrounds",campgroundRoutes); //让campgrounds.js里面的恶routes都自动带上/campgrounds前缀，以简写那个文件
app.use("/campgrounds/:slug/comments",commentRoutes);
app.use("/campgrounds/:slug/reviews", reviewRoutes);




var port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("Yelpcamp Has Started!");
});
