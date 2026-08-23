import StoredFile from "../models/StoredFile.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/ApiResponse.js";

export const downloadFile = asyncHandler(async (req, res) => {
  const file = await StoredFile.findOne({
    filename: req.params.filename,
    public: true,
  }).select("+data");
  if (!file) throw ApiError.notFound("File not found");

  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Content-Length", file.data.length);
  return res.send(file.data);
});

export const listFiles = asyncHandler(async (req, res) => {
  const files = await StoredFile.find({}).select("-data");
  return sendOk(res, { files });
});
