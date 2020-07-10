//所有的middleware都在这里
var Campground= require("../models/campground");
var Comment= require("../models/comment");
var Review = require("../models/review");
var middlewareObj = {};
middlewareObj.checkCampgroundOwnership = function(req,res,next){

    
        if(req.isAuthenticated()){
            Campground.findOne({slug:req.params.slug}, function(err,foundCampground){
                if(err || !foundCampground){
                    req.flash("error", "Campground not found");
                    res.redirect("back")
                }
                else{
                    //检查是不是own the campground                       //超级管理员权限
                    if(foundCampground.author.id.equals(req.user._id) || req.user.isAdmin){  //不能直接用===是因为前者是Method而后者是string
                        next();
                    } 
                    else{
                        req.flash("error", "You don't have permission to do that");
                         res.redirect("back");
                    }
                    
                }
            })
        }
        else{
            req.flash("error", "You need to be logged in to do that");
            res.redirect("back"); //让用户返回让他们来的地方
        }
    }


middlewareObj.checkCommentOwnership = function(req,res,next){
    if(req.isAuthenticated()){
        Comment.findById(req.params.comment_id, function(err,foundComment){
            if(err || !foundComment){
                req.flash("error","Comment not found");
                res.redirect("back")
            }
            else{
                //检查是不是own the comment                        //超级管理员权限
                if(foundComment.author.id.equals(req.user._id) || req.user.isAdmin){  //不能直接用===是因为前者是Method而后者是string
                    next();
                } 
                else{
                    req.flash("error", "You don't have permission to do that");
                     res.redirect("back");
                }
                
            }
        })
    }
    else{
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back"); //让用户返回让他们来的地方
    }
}


middlewareObj.checkReviewOwnership = function(req, res, next) {
    if(req.isAuthenticated()){
        Review.findById(req.params.review_id, function(err, foundReview){
            if(err || !foundReview){
                res.redirect("back");
            }  else {
                // does user own the comment?
                if(foundReview.author.id.equals(req.user._id)) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that");
        res.redirect("back");
    }
};

middlewareObj.checkReviewExistence = function (req, res, next) {
    if (req.isAuthenticated()) {
        Campground.findOne({slug: req.params.slug}).populate("reviews").exec(function (err, foundCampground) {
            if (err || !foundCampground) {
                req.flash("error", "Campground not found.");
                res.redirect("back");
            } else {
                // check if req.user._id exists in foundCampground.reviews
                var foundUserReview = foundCampground.reviews.some(function (review) {
                    return review.author.id.equals(req.user._id);
                });
                if (foundUserReview) {
                    req.flash("error", "You already wrote a review.");
                    return res.redirect("/campgrounds/" + foundCampground.slug);
                }
                // if the review was not found, go to the next middleware
                next();
            }
        });
    } else {
        req.flash("error", "You need to login first.");
        res.redirect("back");
    }
};

//设置权限只有登录才可以发表评论
middlewareObj.isLoggedIn = function(req,res,next){
    if(req.isAuthenticated()){
        return next();
    }
    req.flash("error", "You need to be logged in to do that!"); //直到render login page后我们才能看见这条消息？
    res.redirect("/login"); //而不是先弹出消息后redirect
}


module.exports = middlewareObj;