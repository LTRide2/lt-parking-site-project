# Lesson D4 — Buy a domain, wire it to Route 53, and turn on HTTPS

> **Track:** Deploy · **Lesson 6 of 6**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** moderate (mostly configuration, one irreversible purchase, and a "hurry up and wait" DNS step)
> **🧩 Prerequisites:** you've finished [Lesson D3 — Release the application code](D3-release-application-code.md) — the app is live and reachable at `http://<ElasticIp>`.
> **🌿 CR branch:** `cr/d4-dns-tls` (off `cr/d3-release`) · **📄 Source CR:** [deployment guide → CR D4](../deployment-guide.md#cr-d4--buy-a-domain-wire-it-to-route-53-and-turn-on-https) · **🗺 Big picture:** [plan.md §10](../../plan.md#10-aws-deployment--ec2--rds-via-cloudformation).

---

## 🎯 Goal — what you'll have at the end

A **real, memorable web address with a padlock** instead of a bare IP address. Concretely, by the end of this hour you will have:

- A domain name you own (e.g. `ltride.example.com`), bought at a registrar of your choice.
- A **Route 53 hosted zone** holding that domain's DNS records, with an **A record** pointing at your server's Elastic IP.
- The backend's `CORS_ORIGINS` and the frontend's build both updated to know about the new domain.
- A free **TLS certificate** from Let's Encrypt (via `certbot`), with HTTP automatically redirecting to HTTPS.

**✅ Done when (your deliverable checklist):**
- [ ] `dig your-domain +short` prints your Elastic IP.
- [ ] `https://your-domain` loads in a browser with a **valid padlock** (no certificate warning).
- [ ] `curl -I http://your-domain` returns a `301` redirect to `https://`.
- [ ] `curl https://your-domain/api/health` returns `{"data":{"status":"ok"}}`.
- [ ] Your work is committed on branch `cr/d4-dns-tls` and pushed, PR base = `cr/d3-release`.

---

## 🤔 Why this lesson matters

Right now your site works, but it lives at something like `http://54.12.34.56` — a random number nobody will remember or trust. Two upgrades fix that:

**DNS (Domain Name System)** is the internet's phone book: it turns a name humans can remember (`ltride.example.com`) into the IP address computers actually connect to. Buying a domain is really buying the *right to put an entry in that phone book* — the entry itself lives in a **DNS host**, which is a separate service (we use **AWS Route 53** for that). Getting the two connected — "which phone book does my name point to?" — is the one step beginners most often get stuck on, and it's most of this lesson.

**HTTPS/TLS** matters because plain HTTP sends everything — including login passwords and session tokens — as plain text that any router or Wi-Fi network along the way can read. TLS (what makes the padlock appear) encrypts that traffic so only your browser and your server can read it. It also **proves** to the browser that it's really talking to your server, not an impostor. Browsers increasingly warn users away from plain-HTTP sites entirely, so this isn't optional polish — it's the difference between a site people can trust and one they can't.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **DNS / A record** | The phone-book entry mapping a domain name to an IPv4 address. | [Cloudflare: What is DNS?](https://www.cloudflare.com/learning/dns/what-is-dns/) · [Cloudflare: DNS records](https://www.cloudflare.com/learning/dns/dns-records/) |
| **AWS Route 53** | Amazon's DNS hosting service — the "hosted zone" that holds your domain's records. | [Route 53 developer guide](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html) |
| **Nameservers (NS)** | The pointer, set at your registrar, that tells the internet "ask Route 53 for this domain." | [Route 53: working with hosted zones](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/AboutHZWorkingWith.html) |
| **TLS / HTTPS** | The encryption layer that makes `http://` become `https://` and shows the padlock. | [MDN: What is HTTPS?](https://developer.mozilla.org/en-US/docs/Glossary/HTTPS) · [MDN: Transport Layer Security](https://developer.mozilla.org/en-US/docs/Glossary/TLS) |
| **Let's Encrypt / certbot** | A free certificate authority + the tool that requests and auto-renews its certificates. | [Let's Encrypt](https://letsencrypt.org/how-it-works/) · [certbot docs](https://certbot.eff.org/instructions) |
| **Domain registration** | Renting a domain name for a year at a time from a registrar. | [ICANN: Domain name registration](https://www.icann.org/resources/pages/registration-2013-06-19-en) |

---

## ✅ Before you start

**Time budget for the hour:** choose + buy domain & create hosted zone (15 min) → nameserver hand-off if needed (5 min active + background wait) → A record (5 min) → update app for new hostname (10 min) → certbot / HTTPS (15 min) → test & commit (10 min).

You'll need: a working site at `http://<ElasticIp>` (D3 done), a credit card if you're buying a domain today, and SSH access to the server (`~/.ssh/ltride-key.pem`).

**Open your terminal and make your branch:**

```bash
cd ~/workspace/LTR-Backend
git checkout cr/d3-release
git pull
git checkout -b cr/d4-dns-tls   # create + switch to this lesson's branch
```

**What this does & why:** this CR branches off `cr/d3-release`, not `main`, because it needs the server that D3 already stood up and released code to. → Reference: [Git Branching basics](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell).

---

## 🛠 Build it, step by step

### The mental model first — three things that must line up

1. **Registrar** — who you *buy* the name from (a yearly rental, ~$10–15/yr). Examples: Route 53 itself, Namecheap, Cloudflare.
2. **DNS hosting (the hosted zone)** — the phone book that maps your name to your server's IP. We use **Route 53** for this.
3. **Nameservers (NS)** — set *at the registrar*, telling the internet "ask Route 53 for this domain's records."

If you buy the domain **at Route 53**, steps 2 and 3 happen automatically. If you buy it **elsewhere**, you have to manually copy Route 53's nameservers back to the registrar — that hand-off is Step 2B below. **Pick one path and follow it through.**

### Step 1 — Create a Route 53 hosted zone (~15 min, both paths do this)

A hosted zone is the container in Route 53 that holds your domain's DNS records.

**Console way:**
1. AWS Console → **Route 53** → **Hosted zones** → **Create hosted zone**.
2. **Domain name:** your root domain, e.g. `example.com` (use the root even if your site will live at `ltride.example.com`).
3. **Type:** Public hosted zone → **Create**.
4. AWS immediately shows an **NS record** with 4 nameservers (like `ns-123.awsdns-45.com`). **Copy these four** — you'll need them in Step 2 if you bought elsewhere. Also copy the **Hosted zone ID** (looks like `Z0123456789ABCDEFGHIJ`).

**CLI way (equivalent):**
```bash
aws route53 create-hosted-zone --name example.com --caller-reference "ltride-$(date +%s)"
aws route53 get-hosted-zone --id <HostedZoneId> --query 'DelegationSet.NameServers'
```
**What this does:** `create-hosted-zone` makes the empty phone book; `get-hosted-zone` reads back the 4 nameservers AWS assigned it. → Reference: [Route 53: create a hosted zone](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/AboutHZWorkingWith.html).

Put the Hosted zone ID into `deploy/params/prod.json` so the DNS stack and `release.sh` can find it:
```json
[
  "DomainName=ltride.example.com",
  "HostedZoneId=Z0123456789ABCDEFGHIJ",
  ...
]
```

### Step 2 — Connect the registrar to Route 53 (~5 min active, then a wait)

**If you bought the domain AT Route 53** (Route 53 → Registered domains → Register domains): this is automatic — the hosted zone and nameservers are already wired up. Skip to Step 3.

**If you bought it ELSEWHERE** (Namecheap, Cloudflare, GoDaddy, etc.) — this is the actual "connect my name to Route 53" step:
1. Log into your registrar and find the domain's **Nameservers** setting.
2. Choose **Custom nameservers**, delete the registrar's defaults, and paste the 4 nameservers from Step 1 (one per field, no trailing dots).
3. **Save.** Propagation is usually minutes but can take up to 24–48 hours. Check progress:
   ```bash
   dig NS example.com +short        # should eventually list the 4 awsdns nameservers
   ```
   **What this does:** `dig NS` asks the internet "who's authoritative for this domain's DNS?" — once it answers with the AWS nameservers, the hand-off is complete. → Reference: [dig command basics](https://linux.die.net/man/1/dig).

> **Common mistake:** don't add DNS records at the registrar *and* delegate to Route 53. Once nameservers point at Route 53, the registrar's own records are ignored — every record from now on goes in Route 53 (Step 3).

### Step 3 — Point the domain at your server (~5 min)

Now create the A record: the phone-book entry mapping your domain to your server's Elastic IP. The `04-dns.yaml` stack (from D1) does this from `params/prod.json`:

```bash
cd ~/workspace/LTR-Backend/deploy
./deploy.sh up            # picks up 04-dns.yaml using DomainName + HostedZoneId
```
**What this does:** `deploy.sh up` re-runs CloudFormation for all four stacks; `04-dns.yaml`'s `HasHostedZone` condition is now true (you filled in a real `HostedZoneId`), so it creates an `AWS::Route53::RecordSet` — an **A record** — mapping `ltride.example.com → <ElasticIp>`. → Reference: [Route 53: A records](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/ResourceRecordTypes.html#AFormat).

Verify:
```bash
dig ltride.example.com +short                   # should print your Elastic IP
curl -I http://ltride.example.com/api/health    # should reach your server (200)
```

### Step 4 — Update the app for the new hostname (~10 min)

1. **Tell the backend to trust the new origin.** SSH in and edit the server's `.env`:
   ```bash
   ssh -i ~/.ssh/ltride-key.pem ubuntu@<ElasticIp>
   sudo nano /home/ltride/app/.env    # set CORS_ORIGINS=https://ltride.example.com
   sudo systemctl restart ltride
   ```
   **Why:** `CORS_ORIGINS` is the allow-list Flask checks before letting a browser page call the API (you set this up in backend lesson B0/B1). Without the `https://` domain added here, the browser will block API calls with a CORS error even though the page itself loads. → Reference: [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
2. **Rebuild the frontend** so it calls the domain instead of the raw IP. `release.sh` already builds the UI with `VITE_API_URL=https://<DomainName>` once `DomainName` is set in `params/prod.json`:
   ```bash
   cd ~/workspace/LTR-Backend/deploy
   ./release.sh frontend
   ```

### Step 5 — Get a free TLS certificate with certbot (~15 min)

```bash
ssh -i ~/.ssh/ltride-key.pem ubuntu@<ElasticIp>
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ltride.example.com
```
**What each line does:**
- `apt-get install certbot python3-certbot-nginx` — installs the Let's Encrypt client and its nginx plugin, which knows how to edit nginx configs automatically. → Reference: [certbot instructions](https://certbot.eff.org/instructions).
- `certbot --nginx -d ltride.example.com` — requests a certificate for your domain, **proves you control it** (by briefly answering a challenge over port 80), then edits the nginx config from lesson D1b: it adds a `listen 443 ssl` block, sets `server_name ltride.example.com`, wires in the certificate, and adds an **HTTP → HTTPS redirect**. It also installs a timer that auto-renews the certificate every 90 days (Let's Encrypt certs are short-lived by design). → Reference: [Let's Encrypt: how it works](https://letsencrypt.org/how-it-works/).

Answer certbot's prompts: your email (for renewal notices), agree to the terms, and choose the option to **redirect** HTTP to HTTPS.

---

## 🧪 Prove it works — testing guide

```bash
dig ltride.example.com +short                 # → your Elastic IP
curl -I https://ltride.example.com/api/health # → HTTP/2 200, valid cert
curl -I http://ltride.example.com             # → 301 redirect to https
```

Then open `https://ltride.example.com` in a browser and log in as a seeded student.

**What you should see:**
- `dig` resolves to your Elastic IP.
- The `https://` curl returns `HTTP/2 200` with no certificate error.
- The `http://` curl returns a `301` redirect pointing at the `https://` version.
- The browser shows a **padlock** (a valid Let's Encrypt certificate) — click it to see the certificate details if you're curious.
- Login and the full app work over HTTPS with no CORS errors in the browser console (proof that Step 4.1 worked).

---

## 🚀 Save your work (commit & open the CR)

```bash
git add deploy/params/prod.json deploy/cfn/04-dns.yaml
git commit -m "D4: Route 53 hosted zone + A record + HTTPS via certbot"
git push -u origin cr/d4-dns-tls
```

Then open a Pull Request on GitHub with **base = `cr/d3-release`**. Use the CR description template and paste your "Prove it works" output as the testing evidence. → Reference: [GitHub: Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). The [CR status tracker in plan.md §8.2](../../plan.md#82-cr-status-tracker) is where this CR's status is recorded.

---

## 🧯 If something breaks

- **`dig NS` doesn't show AWS nameservers** — the registrar hand-off (Step 2B) isn't done, or is still propagating. This can take up to 24–48 hours; until it resolves, nothing downstream will work. Be patient and re-check.
- **`dig` shows your IP but the browser can't connect** — the security group isn't allowing port 80/443 (check `01-network.yaml` from D1), or nginx isn't running (`sudo systemctl status nginx` on the server).
- **certbot fails with "challenge failed"** — the domain must already resolve to this server over **port 80** before certbot can verify you own it. Finish Step 3 (and make sure port 80 is open) before running certbot.
- **Padlock works but API calls fail with a CORS error** — you skipped Step 4.1 (`CORS_ORIGINS` must include the `https://` domain) or forgot to restart the backend afterward.
- **`curl http://…` doesn't redirect to https** — certbot's redirect prompt was answered "no" or skipped. Re-run `sudo certbot --nginx -d ltride.example.com` and choose the redirect option.

---

## 📝 Recap

- You learned the three-part DNS model: **registrar** (who you buy from), **DNS host / hosted zone** (Route 53, the phone book), and **nameservers** (the pointer connecting the two).
- You created a Route 53 hosted zone and an A record mapping your domain to your server's Elastic IP.
- You updated the backend's CORS allow-list and rebuilt the frontend for the new hostname.
- You got a free, auto-renewing TLS certificate from Let's Encrypt via `certbot`, and proved HTTP now redirects to HTTPS with a valid padlock.

---

## 📚 References

- [Cloudflare: What is DNS?](https://www.cloudflare.com/learning/dns/what-is-dns/) and [DNS records](https://www.cloudflare.com/learning/dns/dns-records/).
- [AWS Route 53 developer guide](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html) — hosted zones, [A records](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/ResourceRecordTypes.html#AFormat).
- [MDN: HTTPS](https://developer.mozilla.org/en-US/docs/Glossary/HTTPS) and [TLS](https://developer.mozilla.org/en-US/docs/Glossary/TLS).
- [Let's Encrypt — how it works](https://letsencrypt.org/how-it-works/) and [certbot instructions](https://certbot.eff.org/instructions).
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).
- [GitHub Docs — Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
- Source of truth for this lesson: [deployment guide → CR D4](../deployment-guide.md#cr-d4--buy-a-domain-wire-it-to-route-53-and-turn-on-https).

---

## ➡️ Next lesson

**There isn't one — you just finished the whole LTRide lesson series!** Your app now runs on real infrastructure, at a real domain, over HTTPS. That's the full journey from "clean slate" (B0) to a live, secure, production site.

From here: revisit [plan.md](../../plan.md) for the big picture of how every backend, frontend, and deployment lesson fit together, and keep the [deployment guide's Part 2 — operating & troubleshooting](../deployment-guide.md#part-2--operating--troubleshooting-the-live-server) close by — it's your reference for keeping the live site healthy (checking logs, restarting services, handling a changed IP, and the other day-to-day issues that come up once real users show up).
