# 🔑 How to Find Your JWT Token

## 🎯 **What is the JWT Token?**

Your JWT (JSON Web Token) is created when you log into your frontend application. It contains your user information and proves you're authenticated.

From your server logs, I can see you're logged in as:
- **User ID**: `54e6fba3-5619-46f5-895e-951ff49d9a23`
- **Email**: `demo@educore.com`
- **Role**: `admin`

## 🔍 **How to Find Your JWT Token**

### **Method 1: Browser DevTools (Most Common)**

1. **Open your frontend application** in the browser
2. **Press F12** to open DevTools
3. **Go to Application tab**
4. **Look in Local Storage** for keys like:
   - `token`
   - `authToken` 
   - `jwt`
   - `access_token`
   - `supabase.auth.token`
5. **Copy the token value**

### **Method 2: Browser Console**

Open browser console (F12) and try these commands:
```javascript
// Check localStorage
console.log('localStorage token:', localStorage.getItem('token'));
console.log('localStorage authToken:', localStorage.getItem('authToken'));
console.log('localStorage jwt:', localStorage.getItem('jwt'));

// Check sessionStorage
console.log('sessionStorage token:', sessionStorage.getItem('token'));
console.log('sessionStorage authToken:', sessionStorage.getItem('authToken'));

// Check all localStorage keys
Object.keys(localStorage).forEach(key => {
  console.log(key + ':', localStorage.getItem(key));
});
```

### **Method 3: Network Tab**

1. **Open DevTools → Network tab**
2. **Refresh your frontend page**
3. **Look for API requests** to your backend
4. **Click on any request** that goes to `/api/`
5. **Check Request Headers** for `Authorization: Bearer YOUR_TOKEN_HERE`

## 🧪 **Test Your Token**

Once you find your token, test it:

```javascript
// In browser console:
const yourToken = 'YOUR_ACTUAL_TOKEN_HERE'; // Replace with real token

fetch('/api/attendance/bulk-mark', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${yourToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    grade_section_id: '5399ee52-043c-4ca2-64a2-64ab2ea88c4c',
    date: '2025-09-07',
    attendance_records: [{
      student_id: 'test-' + Date.now(),
      status: 'present'
    }]
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## 🎯 **What Should Happen**

When you use the correct JWT token, you should see these logs in your server console:

```
✅ [ATTENDANCE] Successfully marked attendance: {...}
💾 [CACHE] Invalidating all attendance-related caches...
💾 [CACHE] Invalidated: date:2025-09-07:user:54e6fba3-5619-46f5-895e-951ff49d9a23:/api/attendance/grade-sections/daily?date=2025-09-07:
✅ [CACHE] Successfully invalidated 8 cache keys
```

## 🚨 **If You Can't Find the Token**

### **Option 1: Check Your Frontend Code**
Look for where authentication is handled in your frontend:
- Login functions
- API request interceptors  
- Authentication context/store

### **Option 2: Log In Again**
1. **Log out** of your frontend
2. **Log in again** 
3. **Watch Network tab** during login
4. **Find the login response** - it should contain the JWT token

### **Option 3: Enable Demo Mode**
If you can't find the token, temporarily enable demo mode:

1. **Create/edit `.env` file** in your backend root:
   ```
   DEMO_MODE=true
   ```

2. **Restart your server**:
   ```bash
   npm start
   ```

3. **Use demo token**: `demo-jwt-token-12345`

## 🎉 **Once You Have the Token**

Your cache invalidation will work perfectly! You'll see:

- ✅ **Consistent data** between frontend and backend
- ✅ **Grade section cards stay green** after refresh  
- ✅ **Real-time attendance updates**
- ✅ **No more optimistic update mismatches**

## 📞 **Next Steps**

1. **Find your JWT token** using the methods above
2. **Test the bulk-mark endpoint** with your real token
3. **Watch server logs** for cache invalidation messages
4. **Test your frontend** - attendance should work perfectly!

**The cache fix is ready - we just need the right authentication!** 🚀
