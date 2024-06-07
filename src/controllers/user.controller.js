import { User } from "../models/user.model.js"
import asyncHandler from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import JWT from "jsonwebtoken"
import mongoose from "mongoose";


const register = asyncHandler(
    async (req, res) => {
        const { username, password, email, fullName } = req.body;

        if ([username, password, email, fullName].some(item => item?.trim() === "")) {
            throw new ApiError(400, "all fields are required");
        }

        const existedUser = await User.findOne(
            {
                $or: [{ username }, { email }]
            }
        )

        if (existedUser) {
            throw new ApiError(400, "email or username already exist")
        }

        // const avatarFilePath = req.files?.avatar[0]?.path;
        // if (!avatarFilePath) {
        //     throw new ApiError(400, "avatar required")
        // }

        let avatarFilePath;
        if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
            avatarFilePath = req.files?.avatar[0]?.path;
        }

        // const coverImagePath = req.files?.coverImage[0]?.path;
        let coverImagePath;
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
            coverImagePath = req.files?.coverImage[0]?.path;
        }

        const avatar = await uploadOnCloudinary(avatarFilePath)
        const coverImage = await uploadOnCloudinary(coverImagePath)

        console.log(req.files);

        const user = await User.create(
            {
                username: username.toLowerCase(),
                password,
                email,
                fullName,
                avatar: avatar?.url || "https://res.cloudinary.com/dhfoe5edd/image/upload/v1713796296/rcczelsv3zn88aqcum2c_c_crop_ar_1_1_k06k3g.jpg",
                coverImage: coverImage?.url || ""
            }
        )

        const createdUser = await User.findOne(
            { _id: user._id }
        ).select(" -password -refreshToken ");

        if (!createdUser) {
            throw new ApiError(500, "something went wrong while register");
        }

        console.log(createdUser);
        res.status(200).json(new ApiResponse(200, createdUser, "user registered successfully"));
    }
)


export {
    registerUser
}
