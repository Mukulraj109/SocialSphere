import { User } from "../models/user.model.js"
import asyncHandler from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import JWT from "jsonwebtoken"
import mongoose from "mongoose";


const registerUser = asyncHandler(async (req,res) =>{
    res.status(500).json({
        message: "mukul - raj"
    })
})

export {
    registerUser
}
