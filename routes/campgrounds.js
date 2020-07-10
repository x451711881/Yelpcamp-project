var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var Notification = require("../models/notification");
var User = require("../models/user");
var Review = require("../models/review");
var middleware = require("../middleware/index.js"); //引入middleware，当要引入的文件是index时，也可以省略不写，见comment.js

//以下是配置multer
var multer = require('multer');
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
    // accept image files only,不然会报错
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter})
//配置cloudinary
var cloudinary = require('cloudinary').v2;
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});


//index page-show all campgrounds
router.get("/", function(req, res){
    var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    var noMatch = null;
    if(req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        Campground.find({name: regex}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.count({name: regex}).exec(function (err, count) {
                if (err) {
                    console.log(err);
                    res.redirect("back");
                } else {
                    if(allCampgrounds.length < 1) {
                        noMatch = "No campgrounds match that query, please try again.";
                    }
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        page:"campgrounds",
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: req.query.search
                    });
                }
            });
        });
    } else {
        // get all campgrounds from DB
        Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.count().exec(function (err, count) {
                if (err) {
                    console.log(err);
                } else {
                    res.render("campgrounds/index", {
                        campgrounds: allCampgrounds,
                        page:"campgrounds",
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: false
                    });
                }
            });
        });
    }
});

//Create- add new campground to DB
router.post("/", middleware.isLoggedIn, upload.single('image'), async function(req, res) {
    //get data from form,并添加到campgrounds数组
    cloudinary.uploader.upload(req.file.path, async function(err,result) {
        if(err){
            req.flash("error", err.message);
            return res.redirect("back");
        }
        // add cloudinary url for the image to the campground object under image property
        req.body.campground.image = result.secure_url;
        req.body.campground.imageId = result.public_id; //这俩来自cloudinary
        // add author to campground
        req.body.campground.author = {
          id: req.user._id,
          username: req.user.username
        }

        try{
            let campground = await Campground.create(req.body.campground);
            let user = await User.findById(req.user._id).populate("followers").exec();
            let newNotification ={
                username: req.user.username,
                campgroundId: campground.slug

            }

            for (const follower of user.followers){
                let notification = await Notification.create(newNotification);
                follower.notifications.push(notification);
                follower.save();
            }
             //redirect back to campgrounds page
            res.redirect(`/campgrounds/${campground.slug}`);

        }catch(err){
            req.flash('error', err.message);
            res.redirect('back');
        }
       
      });
    //重定向去campgrounds
      //重定向默认是定位回get类型
});

//===============Show form to create a new campground===============//
router.get("/new", middleware.isLoggedIn,function(req,res){
      res.render("campgrounds/new");
})
//===================Show-shows more info about one campground================//
router.get("/:slug", function(req,res){
    //find the campground with provided id

    Campground.findOne({slug: req.params.slug}).populate("comments likes").populate({
        path: "reviews",
        options: {sort: {createdAt: -1}}
    }).exec(function(err,result){
         if(err || !result){
             req.flash("error", "Campground not found");
             res.redirect("back");
         }
         else{
            //render the show template with that campground
            res.render("campgrounds/show",{campground:result});
         }
    });
    
    
   
})

// =================== Campground Like Route  ==========================//
router.post("/:slug/like", middleware.isLoggedIn, function (req, res) {
    Campground.findOne({slug:req.params.slug}, function (err, foundCampground) {
        if (err) {
            console.log(err);
            return res.redirect("/campgrounds");
        }

        // check if req.user._id exists in foundCampground.likes
        var foundUserLike = foundCampground.likes.some(function (like) {
            return like.equals(req.user._id);
        });

        if (foundUserLike) {
            // user already liked, removing like
            foundCampground.likes.pull(req.user._id);
        } else {
            // adding the new user like
            foundCampground.likes.push(req.user);
        }

        foundCampground.save(function (err) {
            if (err) {
                console.log(err);
                return res.redirect("/campgrounds");
            }
            return res.redirect("/campgrounds/" + foundCampground.slug);
        });
    });
});

//============Edit campground route===========//
router.get("/:slug/edit", middleware.checkCampgroundOwnership, function(req,res){
    
        Campground.findOne({slug: req.params.slug}, function(err,foundCampground){
            res.render("campgrounds/edit",{campground: foundCampground});
        })
    })           
                

    
//===========Update campground route ===========//
router.put("/:slug", middleware.checkCampgroundOwnership, upload.single('image'), function(req,res){
    
    delete req.body.campground.rating;
    Campground.findOne({slug: req.params.slug}, function(err, updatedCampground){
        if(err){
            req.flash("error",err.message);
            res.redirect("/campgrounds");
        }
        else{
            //如果上传了新图，则删除旧图替换成新图
            if(req.file){
            
                    cloudinary.uploader.destroy(updatedCampground.imageId, function(err){
                        if(err){
                            req.flash("error",err.message);
                            return res.redirect("back"); 
                        }
                        cloudinary.uploader.upload(req.file.path, function(err,result){
                            if(err){
                                req.flash("error",err.message);
                                return res.redirect("back"); 
                            }
                             //更新图片  
                            updatedCampground.image = result.secure_url;
                            updatedCampground.imageId = result.public_id;
                            updatedCampground.name = req.body.campground.name;
                            updatedCampground.description = req.body.campground.description;
                            updatedCampground.price = req.body.campground.price;
                            updatedCampground.save();
                            req.flash("success", "Successfully Updated!");
                            res.redirect("/campgrounds/"+campground.slug);
                        });
                    });
                }
                        
                    
            else{
                updatedCampground.name = req.body.campground.name;
                updatedCampground.description = req.body.campground.description;
                updatedCampground.price = req.body.campground.price;
                updatedCampground.save();
                req.flash("success", "Successfully Updated!");
                res.redirect("/campgrounds/"+campground.slug);
            }  
                
            
            }
            
        })
    })


// //================Destory Campground Route 删除 ===============//
router.delete("/:slug",middleware.checkCampgroundOwnership,function(req,res){
    Campground.findOne({slug: req.params.slug}, async function(err, campground){
        if(err){
            req.flash("error",err.message);
            res.redirect("/campgrounds");
        }
        else{
            Comment.remove({"_id": {$in: campground.comments}}, function (err) {
                if (err) {
                    console.log(err);
                    return res.redirect("/campgrounds");
                }
                // deletes all reviews associated with the campground
                Review.remove({"_id": {$in: campground.reviews}},  async function (err) {
                    if (err) {
                        console.log(err);
                        return res.redirect("/campgrounds");
                    }
                    try {
                        await cloudinary.uploader.destroy(campground.imageId);
                        campground.remove();
                        req.flash('success', 'Campground deleted successfully!');
                        res.redirect('/campgrounds');
                    } catch(err) {
                        if(err) {
                          req.flash("error", err.message);
                          return res.redirect("back");
                        }
                    }

                })
            })
  

            
        }
    })
})




//将用户输入整个转化为正则表达式的字面字符串的函数
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};


module.exports = router;

