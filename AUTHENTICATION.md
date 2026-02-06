# Authentication System

This document describes the authentication system implemented for the Bingo Game application.

## Overview

The authentication system uses:

- **Phone Number** as the primary identifier
- **PIN** (4-6 digits) for authentication
- **OTP Verification** for signup process
- **JWT Tokens** for session management

## Backend API Endpoints

### Authentication Routes (`/api/auth`)

#### 1. Send OTP for Signup

```
POST /api/auth/send-otp
```

**Request Body:**

```json
{
  "phoneNumber": "+251912345678"
}
```

**Response:**

```json
{
  "message": "OTP sent successfully",
  "otp": "123456" // Only in development mode
}
```

#### 2. Verify OTP and Complete Signup

```
POST /api/auth/verify-otp
```

**Request Body:**

```json
{
  "phoneNumber": "+251912345678",
  "otp": "123456",
  "pin": "1234",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "message": "Signup successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "phoneNumber": "+251912345678",
    "balance": 100,
    "isVerified": true
  }
}
```

#### 3. Login

```
POST /api/auth/login
```

**Request Body:**

```json
{
  "phoneNumber": "+251912345678",
  "pin": "1234"
}
```

**Response:**

```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "phoneNumber": "+251912345678",
    "balance": 100,
    "isVerified": true
  }
}
```

#### 4. Get Profile (Protected)

```
GET /api/auth/profile
Authorization: Bearer jwt_token_here
```

**Response:**

```json
{
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "phoneNumber": "+251912345678",
    "balance": 100,
    "isVerified": true
  }
}
```

#### 5. Resend OTP

```
POST /api/auth/resend-otp
```

**Request Body:**

```json
{
  "phoneNumber": "+251912345678"
}
```

## Frontend Components

### Authentication Flow

1. **AuthPage**: Main authentication container
2. **LoginForm**: Login with phone number and PIN
3. **SignupForm**: Signup with phone number, PIN, and OTP verification
4. **ProtectedRoute**: Route protection wrapper
5. **AuthContext**: Authentication state management

### Key Features

- **Automatic Token Management**: Tokens are stored in localStorage and automatically included in API requests
- **Route Protection**: All game routes require authentication
- **OTP Display**: In development mode, OTP is displayed in the UI for testing
- **Responsive Design**: Mobile-friendly authentication forms

## Security Features

### Backend

- PIN hashing using bcryptjs
- JWT token-based authentication
- Phone number validation
- OTP expiration (10 minutes)
- Protected routes with token verification

### Frontend

- Automatic token refresh
- Secure token storage
- Protected route components
- Input validation and sanitization

## Testing

### Manual Testing

1. Start the backend server: `npm start`
2. Start the frontend: `npm run dev`
3. Navigate to the application
4. Test signup flow with OTP verification
5. Test login with phone number and PIN
6. Verify protected routes work correctly

### Development Features

- OTP codes are logged to console and returned in API responses
- Test user creation with default balance of 100 birr
- Comprehensive error handling and user feedback

## Environment Variables

### Backend

- `JWT_SECRET`: Secret key for JWT token signing
- `NODE_ENV`: Set to "development" for OTP display

### Frontend

- `REACT_APP_API_URL`: Backend API URL (defaults to localhost:5000)

## Database Schema

### User Model

```javascript
{
  name: String,
  email: String, // Optional
  phoneNumber: String (required, unique),
  pin: String (hashed, required),
  balance: Number (default: 100),
  isVerified: Boolean (default: false),
  otpCode: String,
  otpExpires: Date,
  timestamps: true
}
```

## Error Handling

The system provides comprehensive error handling:

- Invalid phone number format
- PIN length validation
- OTP expiration
- Duplicate phone numbers
- Invalid credentials
- Network errors
- Token expiration

## Future Enhancements

1. **SMS Integration**: Replace dummy OTP with real SMS service
2. **Biometric Authentication**: Add fingerprint/face recognition
3. **Two-Factor Authentication**: Enhanced security for high-value transactions
4. **Social Login**: Google, Facebook integration
5. **Password Recovery**: Forgot PIN functionality
6. **Account Lockout**: Brute force protection
