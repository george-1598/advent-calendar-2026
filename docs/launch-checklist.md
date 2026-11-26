# Launch checklist: two-account test

About 20 minutes. Everything here was tested with simulated server replies; this
run checks it against the real site, real accounts and real phones.

**You need:** your phone (signed in as you, the admin) and a second device or a
**private browser window** for a test account (e.g. `test+1@yourmail.com`; any
address works, emails aren't confirmed).

Site: https://george-1598.github.io/advent-calendar-2026/

Tick each box. If something looks wrong, note the step number. Problems also show
up in **Admin → Health**.

---

## A. Install & basics (your phone)
- [ ] 1. Open the site in Safari (iPhone) or Chrome (Android). The "Put the calendar on your home screen" card appears.
- [ ] 2. Add it to the home screen. The icon is a gold-ribboned present.
- [ ] 3. Open it from the icon: full screen, no browser bar, you're still signed in.
- [ ] 4. Pick a theme in **Theme**, go back: it's remembered after closing and reopening the app.

## B. Your calendar, as admin
- [ ] 5. **Admin → Quests**: open **🔤 Badge phrase**, write a phrase, pick a filler, save. "Which day gives which badge" lists 25 days.
- [ ] 6. Open **🎉 Finale message**, write one (try `{name}`), save.
- [ ] 7. Open day 1, replace the test riddle: pick **✨ Start from an example**, change it, write the gift (try `{name}` in it), add 3 hint lines, save. "Default saved ✓".
- [ ] 8. Upload a photo in a photo game (e.g. switch day 2 to *Zoom reveal*): the photo appears in the editor. *(First real upload to quest photo storage.)*
- [ ] 9. The reminders above the tabs list the days still empty that open soon.

## C. Friend calendar (test account)
In the private window / second device:
- [ ] 10. Create an account (any name). You land on the calendar straight away (no email step).
- [ ] 11. Footer says **✋ Ask to make your own calendar**. Tap it, write a note, **Ask to become a creator**. The button now says **⏳ Calendar request sent**.
- [ ] 11a. Your phone: **Admin** shows "<test name> wants to make a calendar" → **Approve**. (In **Players**, their badge says *creator*.)
- [ ] 11b. Test account: reload. The button says **🎁 Make a calendar for friends** → name it → **Create my calendar**.
- [ ] 12. **+ Create an invite link** → **Share / copy**. Send the link to yourself.
- [ ] 13. Fill in a day that's already open *for testing*, e.g. set its game to Riddle with an easy answer and a gift.

## D. Joining (your phone)
- [ ] 14. Open the invite link: "<test name> made you an advent calendar". You're already signed in, so it says **You're in!**
- [ ] 15. Open the same link again: "already been used or cancelled".
- [ ] 16. The calendar has two chips at the top: **🎄 Advent Calendar 2026** and **🎁 From <test name>**. Switch between them; the days change.
- [ ] 17. Back on the test account: **Friends** shows you as joined.

> Days open on their date (Bucharest time), so before December 1 every door is
> locked for players. To test playing early, the creator can preview their own
> calendar (step 18), or test on December 1–2.

## E. Playing (from Dec 1, or via preview)
- [ ] 18. Test account: **Friends → Preview my calendar**. Opening a filled-in day plays the door animation once.
- [ ] 19. Your phone (from Dec 1): open day 1 on your calendar. Door animation, then the quest. `{name}` shows your first name.
- [ ] 20. Answer wrong 3 times: **Hint 1** appears, with "another hint after 3 more".
- [ ] 21. Answer right: gift, badge character, **💌 Send a thank-you**. Send one.
- [ ] 22. Under the gift: **📸 Add a photo**. Upload one, add a caption. It shows; reload, it's still there. *(First real memory upload.)*
- [ ] 23. **Badges**: the day's character appears; "1 of 25 characters collected".
- [ ] 24. On a friend calendar, a day the creator left empty shows "<name> is still preparing this one" and a 🛠️ on the calendar.

## F. Creator side (test account, after step 21–22 on their calendar)
- [ ] 25. **Activity**: "<you> solved day N", your thank-you (highlighted), your photo.
- [ ] 26. Get stuck on purpose (3+ wrong answers as the friend): **Needs help** lists it. Send a hint.
- [ ] 27. Friend's phone: a 💬 banner on the calendar, the hint at the top of the day.
- [ ] 28. After 10 wrong tries: **🏳️ I give up** works, the badge is grey, the answer is shown (word games).

## G. Admin views (your phone)
- [ ] 29. **Admin → Players**: the test account is listed with its progress and guesses. "Last seen" updates.
- [ ] 30. **Admin → Health**: "All good", or any problems from this test, with the device and step.

## H. Clean up
- [ ] 31. Test account: **Friends → Delete this calendar…** → confirm. Your phone no longer shows its chip.
- [ ] 32. Ask Claude to reset any test progress on *your* calendar before December 1 (anything you solved while testing).

---

### If something fails
Note the step and what you saw (a screenshot helps), check **Admin → Health**, and
send it to Claude.
