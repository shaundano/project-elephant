# Frontend Implementation

Alright, so we're gonna test this whole process. Let's go ahead and schedule a meeting.

![Schedule Meeting](../images/Phase 4/Screenshot 2025-12-07 at 12.52.28 PM.png)

!!! info "Note - Placeholder Names"
    ([Boonki Goongo](https://www.youtube.com/watch?v=Npxw4Y7w9RE&t=209s) : all my placeholder students are from this video)

If the frontend is working correctly (if not, check the developer console in your browser), you will schedule the meeting, and get to a page like this:

![Meeting Links](../images/Phase 4/Screenshot 2025-12-07 at 12.52.34 PM.png)

These are the meeting links for both the student and the teacher. The id for the DynamoDB row and their role are passed in as parameters in the header. This will enable the redirect via the get-dcv-url Lambda. Copy one, and it will take you here:

![Meeting Launch](../images/Phase 4/Screenshot 2025-12-07 at 12.52.42 PM.png)

Once media permissions are enabled, the "Launch My Meeting" button becomes available. Which is going to trigger a new API Gateway Endpoint and Lambda that we will discuss now.

---

**Next: [Get DCV URL →](get-dcv-url.md)**

