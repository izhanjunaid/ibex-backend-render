# Android FCM Integration - Final Guide

## 🎯 **Your Android App Code (Correct Implementation)**

### **1. FCM Token Registration (After Login)**

```kotlin
// In your AuthViewModel or Login Activity
private fun registerFCMToken() {
    lifecycleScope.launch {
        try {
            // Get FCM token from Firebase
            val fcmToken = FirebaseMessaging.getInstance().token.await()
            
            Log.d("FCM", "Got FCM token: ${fcmToken?.take(20)}...")
            
            // Register token with your backend
            // Note: No need to send userId - it's automatically extracted from JWT token
            val response = supabase.functions.invoke("push-notifications") {
                body = mapOf(
                    "action" to "register-token",
                    "data" to mapOf(
                        "token" to fcmToken,
                        "deviceType" to "android",
                        "deviceName" to Build.MODEL
                    )
                )
            }
            
            Log.d("FCM", "Token registration response: $response")
            
        } catch (e: Exception) {
            Log.e("FCM", "Failed to register FCM token", e)
        }
    }
}
```

### **2. Call After Login**

```kotlin
// In your login success callback
private fun onLoginSuccess() {
    // Your existing login success code...
    
    // Register FCM token
    registerFCMToken()
}
```

### **3. Handle New FCM Tokens**

```kotlin
class MyFirebaseMessagingService : FirebaseMessagingService() {
    
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM", "New FCM token: ${token.take(20)}...")
        
        // Register the new token
        registerFCMToken(token)
    }
    
    private fun registerFCMToken(token: String) {
        lifecycleScope.launch {
            try {
                val response = supabase.functions.invoke("push-notifications") {
                    body = mapOf(
                        "action" to "register-token",
                        "data" to mapOf(
                            "token" to token,
                            "deviceType" to "android",
                            "deviceName" to Build.MODEL
                        )
                    )
                }
                
                Log.d("FCM", "Token registration response: $response")
                
            } catch (e: Exception) {
                Log.e("FCM", "Failed to register FCM token", e)
            }
        }
    }
}
```

---

## 🔑 **Important Authentication Notes**

### **JWT Token Required**
- Your Android app **MUST** be authenticated with a valid JWT token
- The Edge Function automatically extracts the user ID from the JWT token
- **No need to send `userId` in the request body**

### **Request Format**
```json
POST https://ngbpndbjxmhffhcpkgas.supabase.co/functions/v1/push-notifications
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "action": "register-token",
  "data": {
    "token": "fcm_token_here",
    "deviceType": "android",
    "deviceName": "device_model"
  }
}
```

---

## 📱 **What Your Users Will Receive**

### **Attendance Notifications**
- **Title:** "✅ Attendance Marked"
- **Body:** "Hi [Name]! Your attendance has been marked as [Status] for [Date] in [Grade Section]."
- **Data:** `{ type: "attendance", status: "present", date: "2025-08-24", ... }`

### **Test Notifications**
- **Title:** "🎓 Test Notification"
- **Body:** "This is a test notification from the FCM system!"
- **Data:** `{ type: "test", timestamp: "...", test_id: "..." }`

---

## 🧪 **Testing Steps**

### **1. Test FCM Token Generation**
```kotlin
FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
    if (task.isSuccessful) {
        val token = task.result
        Log.d("FCM_TEST", "✅ FCM Token generated: ${token?.take(20)}...")
    } else {
        Log.e("FCM_TEST", "❌ FCM Token failed: ${task.exception}")
    }
}
```

### **2. Test Edge Function Call**
```kotlin
private fun testEdgeFunctionCall(token: String) {
    lifecycleScope.launch {
        try {
            val response = supabase.functions.invoke("push-notifications") {
                body = mapOf(
                    "action" to "register-token",
                    "data" to mapOf(
                        "token" to token,
                        "deviceType" to "android",
                        "deviceName" to "Test Device"
                    )
                )
            }
            Log.d("FCM_TEST", "✅ Edge Function response: $response")
        } catch (e: Exception) {
            Log.e("FCM_TEST", "❌ Edge Function failed: ${e.message}")
        }
    }
}
```

---

## 🚨 **Common Issues & Solutions**

### **1. Authentication Error (401)**
- **Cause:** User not logged in or JWT token expired
- **Solution:** Ensure user is authenticated before calling the function

### **2. FCM Token Not Generated**
- **Cause:** Firebase setup issue
- **Solution:** Check Firebase configuration and dependencies

### **3. Network Error**
- **Cause:** No internet connection or Supabase URL incorrect
- **Solution:** Check internet connection and Supabase configuration

### **4. Edge Function Error (500)**
- **Cause:** Backend issue
- **Solution:** Check Supabase Edge Function logs

---

## ✅ **Backend Status: READY**

- ✅ Edge Function deployed and working
- ✅ FCM token registration functional
- ✅ Attendance notifications automated
- ✅ Multi-device support enabled
- ✅ Database properly configured

---

## 🚀 **Implementation Checklist**

- [ ] Add FCM token registration after login
- [ ] Handle new FCM tokens in FirebaseMessagingService
- [ ] Test with real device
- [ ] Verify notifications are received
- [ ] Test attendance marking triggers notifications

---

## 📞 **Support**

If you encounter any issues:
1. Check Android logs for FCM token generation
2. Check Android logs for Edge Function responses
3. Verify user authentication status
4. Test with the provided test code

**The backend is 100% ready - just implement the Android code above!** 🎉
