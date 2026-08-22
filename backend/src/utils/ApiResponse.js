export class ApiResponse {
  constructor(data = null, message = "OK") {
    this.success = true;
    this.data = data;
    this.message = message;
  }
}

export function sendOk(res, data, message = "OK", statusCode = 200) {
  return res.status(statusCode).json(new ApiResponse(data, message));
}
