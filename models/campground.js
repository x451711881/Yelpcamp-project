var mongoose= require("mongoose");
//schema setup
var campgroundsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: "Campground name cannot be blank."
    },
    price:Number,
    image: String,
    imageId: String,
    description: String,
    createdAt: { type: Date, default: Date.now },
    author:{
        id:{
              type: mongoose.Schema.Types.ObjectId,
              ref: "User"
        },
        username: String
    },
    comments:[
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Comment"
        }
    ],
    slug: {
        type: String,
        unique: true
    },
    likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
    reviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Review"
        }
    ],
    rating: {
        type: Number,
        default: 0
    }

});

// add a slug before the campground gets saved to the database
campgroundsSchema.pre('save', async function (next) {
    try {
        // check if a new campground is being saved, or if the campground name is being modified
        if (this.isNew || this.isModified("name")) {
            this.slug = await generateUniqueSlug(this._id, this.name);
        }
        next();
    } catch (err) {
        next(err);
    }
})



var Campground = mongoose.model("Campground", campgroundsSchema);

module.exports = Campground;



//To generate a unique slug based on the campground name, we will create a function called generateUniqueSlug:
async function generateUniqueSlug(id, campgroundName, slug) {
    try {
            // generate the initial slug
            if (!slug) {
                slug = slugify(campgroundName);
            }
            // check if a campground with the slug already exists
            var campground = await Campground.findOne({slug: slug});
            // check if a campground was found or if the found campground is the current campground
            if (!campground || campground._id.equals(id)) { //check是否equal是在看是不是在编辑同一个
                return slug;
            }
            else{
                // if not unique, generate a new slug
                var newSlug = slugify(campgroundName);
                // check again by calling the function recursively
                return await generateUniqueSlug(id, campgroundName, newSlug);
            }
            
    } catch (err) {
        throw new Error(err);
    }
}
//The slugify function takes the campground name and generates a friendly URL string based on it 
function slugify(text) {
    var slug = text.toString().toLowerCase()
        .replace(/\s+/g, '-')        // Replace spaces with -
        .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
        .replace(/\-\-+/g, '-')      // Replace multiple - with single -
        .replace(/^-+/, '')          // Trim - from start of text
        .replace(/-+$/, '')          // Trim - from end of text
        .substring(0, 75);           // Trim at 75 characters
    return slug + "-" + Math.floor(1000 + Math.random() * 9000);  // Add 4 random digits to improve uniqueness
}


