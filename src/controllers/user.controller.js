import { User } from "../models/user.model.js"
import asyncHandler from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import JWT from "jsonwebtoken"
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "error while creating tokens")
    }
}

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

const login = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    if (!password) {
        throw new ApiError(400, "password is required")
    }

    const user = await User.findOne(
        {
            $or: [{ username }, { password }]
        }
    )

    if (!user) {
        throw new ApiError(400, "user doesnot exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(400, "invalid password")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select(" -password -refreshToken ");

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200, loggedInUser, "user logged in successfully"))

})

const logout = asyncHandler(async (req, res) => {

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: [{ refreshToken: 1 }]
        },
        { new: true }
    );

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, user, `${user.username} has logged out`))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incommingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incommingRefreshToken) {
        throw new ApiError(401, "unauthorized user")
    }

    try {

        const decodedToken = JWT.verify(incommingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(404, "user does not exist");
        }

        if (incommingRefreshToken != user.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used")
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

        const options = {
            httpOnly: true,
            secure: true
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(new ApiResponse(201,
                {
                    accessToken,
                    refreshToken
                },
                "access token refreshed successfully"
            ))

    } catch (error) {
        throw new ApiError(400, error?.message || "invalid refresh token");
    }
});



export {
    register,
    login,
    generateAccessAndRefreshToken,
    logout,
    refreshAccessToken 
}