import User from '../models/user.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import sendMail from '../utils/sendMail.js';
//create user
const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  if ([username, email, password].some((field) => !field?.trim())) {
    throw new ApiError(400, 'Please add all fields');
  }
  const userExist = await User.findOne({ email });
  if (userExist) {
    throw new ApiError(409, 'User already exists');
  }
  const user = await User.create({ username, email, password });
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save();
  const options = {
    httpOnly: true,
    secure: true,
  };
  const refreshOptions = {
    httpOnly: true,
    secure: true,
    path: '/refresh_token',
  };
  return res
    .status(201)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, refreshOptions)
    .json(
      new ApiResponse(201, {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      }),
    );
});
//login user
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email && !password) {
    throw new ApiError(400, 'Please add all fields');
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid credentials');
  }
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  const options = {
    httpOnly: true,
    secure: true,
  };
  const refreshOptions = {
    httpOnly: true,
    secure: true,
    path: '/refresh_token',
  };
  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', refreshToken, refreshOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
          },
        },
        'Logged in successfully',
      ),
    );
});
//logout user
const logoutUser = asyncHandler(async (req, res) => {
  const loggedOutUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      $set: {
        refreshToken: null,
      },
    },
    { new: true },
  );
  console.log(loggedOutUser);
  const options = {
    httpOnly: true,
  };
  return res
    .status(200)
    .clearCookie('accessToken', options)
    .clearCookie('refreshToken')
    .json(new ApiResponse(200, {}, 'Logged out successfully'));
});
//refreshToken
const refreshToken = asyncHandler(async (req, res) => {
  const userRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
  if (!userRefreshToken) {
    throw new ApiError(401, 'Please provide refresh token');
  }
  const payload = jwt.verify(userRefreshToken, process.env.JWT_REFRESH_TOKEN);
  if (!payload) {
    throw new ApiError(401, 'Invalid refresh token');
  }
  const user = await User.findById(payload._id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  if (user?.refreshToken !== userRefreshToken) {
    throw new ApiError(401, 'Invalid refresh token');
  }
  const accessToken = user.generateAccessToken();
  const options = {
    httpOnly: true,
    secure: true,
  };
  const refreshOptions = {
    httpOnly: true,
    secure: true,
    path: '/refresh_token',
  };
  return res
    .status(200)
    .cookie('accessToken', accessToken, options)
    .cookie('refreshToken', user.refreshToken, refreshOptions)
    .json(new ApiResponse(200, { accessToken }, 'Refreshed successfully'));
});
//update user
const updateUser = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { username, email, avatar } = req.body;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  user.username = username || user.username;
  user.email = email || user.email;
  user.avatar = avatar || user.avatar;
  await user.save();
  return res
    .status(200)
    .json(new ApiResponse(200, { user }, 'User updated successfully'));
});
//forgot password
const forgotPassword = asyncHandler(async (req, res) => {
  //email through body
  const email = req.body.email;
  //check if email exists
  if (!email) {
    throw new ApiError(400, 'Please provide email');
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  //generate token
  const resetToken = user.generateResetToken();
  await user.save();
  //send email with token
  const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
  const message = `Click here to reset your password: ${resetUrl}`;
  sendMail(email, 'Reset Password', message);
  return res.status(200).json(new ApiResponse(200, {}, 'Email sent'));
});
//reset password
const resetPassword = asyncHandler(async (req, res) => {});

export {
  registerUser,
  updateUser,
  loginUser,
  logoutUser,
  forgotPassword,
  refreshToken,
  resetPassword,
};
