import mongoose , {Schema} from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
    {
        username:{
            type:String,
            required:true,
            unique:true,
            lowercase:true,
            trim:true,
            index:true
        },
        email:{
            type:String,
            required:true,
            lowercase:true,
            unique:true,
            trim:true,
        },

        fullName: {
            type: String,
            required: true,
            trim: true, 
            index: true
        },

        password: {
            type: String,
            required: [true, 'Password is required']
        },
        
        refreshToken: {
            type: String
        },

        role: {
            type: String,
            enum: ["USER", "ADMIN"],
            default: "USER"
        },
        
    },
    {timestamps:true}
)

//* pre save hook to hash the password
userSchema.pre("save", async function (next){
    if(!this.isModified("password")) return next(); // if password is not changed or new then please dont run this hook

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password,salt);

    next();
})

userSchema.methods.verifyPassword = async function (password){
    return await bcrypt.compare(password,this.password);
}

//* tokens and security
userSchema.methods.generateAccessToken = function (){
    return jwt.sign(
        {
            _id:this._id,
            username:this.username,
            email:this.email,
            role:this.role
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User",userSchema);