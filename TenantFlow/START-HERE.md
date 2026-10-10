# Pari, Task 02 ko aise run karo

Ye **TenantFlow** hai — TeamSync se alag project. TeamSync port 3000 use karta hai; TenantFlow port 3001.

1. ZIP extract karo aur inner **TenantFlow** folder VS Code mein open karo.
2. Node.js 24 LTS use karo.
3. Terminal mein commands run karo:

```bash
npm ci
npm run setup
npm run build
npm start
```

4. Browser: **http://localhost:3001**.
5. Account create karo → organization selector → organization create karo.
6. Projects add karo; Team members mein invitation link banao.
7. Same account se doosri organization create karo — projects aur billing independent rahenge.

**Stripe ke bina:** Login, organizations, projects, permissions, invitations aur Starter limits chalenge. Payment buttons configuration pending dikhayenge. Fake upgrade/payment success nahi diya gaya.

**Stripe configure karne ke liye:** `docs/STRIPE-SETUP.md` follow karo. `.env` mein apni Stripe test secret key, two monthly Price IDs aur webhook signing secret add karna hoga. Secrets chat/GitHub mein mat bhejna.

**LinkedIn:** `docs/LINKEDIN-POST.md` mein draft hai. Apna actual sandbox test complete karke result sentence update karo, phir repository/live link add karke post karna.

**Diagram:** `docs/architecture.svg` ko browser mein open kar sakti ho. README mein embedded image bhi hai, isliye Mermaid extension ke bina diagram mil jayega.

**Verification:** `npm test` mein 9 automated security/billing scenarios hain. Stripe external calls mocked hain; actual sandbox payment flow, browser visuals aur PostgreSQL deployment separately verify karna hoga.

`.env`, `data/`, `node_modules/` GitHub par push mat karna. Saved local database `data/tenantflow.db` hai.
