class ApiResponse {
    constructor(statusCode, data, message="success", pagination){
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
        if (pagination) this.pagination = pagination;
    }
}

export {ApiResponse}