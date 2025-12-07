# Frontend

The first thing you should do is access the frontend wireframe via the repository. The way that I run things locally is using Live Server, which is a really useful plugin for VSCode when running anything static; vanilla JS and HTML are perfect for this.

![Frontend Wireframe 1](../images/Phase 4/Screenshot 2025-12-07 at 9.05.50 AM.png)
![Frontend Wireframe 2](../images/Phase 4/Screenshot 2025-12-07 at 9.05.58 AM.png)

`index.html` is the entry point for my simple frontend. If you launch with Live Server, you should see this:

![Frontend Interface](../images/Phase 4/Screenshot 2025-12-07 at 9.07.50 AM.png)

!!! info "Note - Frontend Simplicity"
    Note that my frontend is super basic and mostly AI-generated. In a production environment, you would probably integrate 3rd party components, would make all the underlying API calls. Therefore the HTTP requests are the most important part.

## Key Code Components

These are the two most important chunks in `scheduleForm.js`:

### Payload Definition

```javascript
const payload = {
    teacher_name: teacherName,
    student_name: studentName,
    meet_time: convertToISOString(meetTime, timezone),
    frontend_base_url: frontendBaseUrl
};
```

- This defines the payload that we're going to send to our API Gateway.

### HTTP Request

```javascript
const response = await fetch(API_GATEWAY_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
});
```

- This is the actual request. Note that it is a POST request, meaning that it actually has a payload.
- `API_GATEWAY_URL` is a static variable that I define in my `.env` file.

!!! warning "Warning - API Security"
    I think that you should probably keep your API URLs hidden. Normally, you can have a secret key for accessing an API, but I don't have one (lol). I may have defined one in AWS, but if that is the case, I'm not exactly sure how that would vet local traffic. The only thing I can imagine is that with a security group, you can limit which IP addresses get through. Regardless, I'm not gonna share my URL and you should probably be more secure than I was.

At this point, you don't have an API URL, so the frontend won't do anything. We're going to set up API Gateway so that we have an endpoint to hit, but first we need to write our schedule meeting Lambda. We're going to write it pretending we already have a way to send this whole payload to it.

---

**Next: [Schedule-meeting Lambda →](schedule-meeting-lambda.md)**

