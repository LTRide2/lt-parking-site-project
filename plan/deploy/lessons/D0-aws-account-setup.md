# Lesson D0 — One-time AWS account setup

> **Track:** Deploy · **Lesson 1 of 6**
> **⏱ Time:** ~60 min · **🎚 Difficulty:** gentle (no code today — this is account setup and safety habits)
> **🧩 Prerequisites:** an email address + a credit card (AWS requires one to create an account, even for cheap/free-tier usage); the backend runnable locally (you can `cd webapp && flask run` and hit `/api/health`).
> **🌿 CR branch:** None — D0 is one-time account setup, not a code change. **📄 Source CR:** [deployment guide → D0](../deployment-guide.md#d0--one-time-aws-account-setup-not-a-code-cr-but-do-it-once) · **🗺 Big picture:** [plan.md §10](../../plan.md#10-aws-deployment--ec2--rds-via-cloudformation).

---

## 🎯 Goal — what you'll have at the end

An AWS account that is **ready for the deploy lessons** and **safe to leave running unattended**. Concretely, by the end of this hour you will have:

- A real AWS account, with an email + credit card on file.
- An **admin IAM user** (not the root login) with an Access key ID + Secret access key saved somewhere private.
- The **AWS CLI installed and configured** on your laptop, proven by a command that prints your account identity.
- An **SSH key pair** (`ltride-key.pem`) downloaded and locked down at `~/.ssh/ltride-key.pem`.
- Your real settings (your IP, your key name) filled into `deploy/params/prod.json`.

**✅ Done when (your deliverable checklist):**
- [ ] `aws sts get-caller-identity` prints your account ID and an `arn` containing the IAM user you created (not `:root`).
- [ ] `ls -l ~/.ssh/ltride-key.pem` shows `-rw-------` (macOS/Linux), or `icacls $HOME\.ssh\ltride-key.pem` lists only your user with `(R)` (Windows) — owner-only access either way.
- [ ] `deploy/params/prod.json` has your real `AdminCidr` and `KeyName` filled in (no more placeholder values).
- [ ] You know where to click to see your AWS bill, and you've set a billing alarm (or at least know how you'll check spend).

---

## 🤔 Why this lesson matters

Every lesson from here on assumes AWS is already set up — if this lesson is rushed or skipped, every later `deploy.sh` command will fail in confusing ways (bad credentials, wrong region, SSH refused). So we do it once, carefully, now.

There's also a **money** reason this lesson matters more than the others: AWS is not free. The instances this project uses cost real dollars per hour, billed automatically to the card you attach today. Nothing here bankrupts a student project if you're careful, but "careful" means specific habits: using an admin **IAM user** instead of the all-powerful root login (so a leaked key can't destroy the whole account), restricting SSH to only your IP (so randoms on the internet can't even try to log in), and — most importantly — **remembering to run `./deploy.sh down` when you're done experimenting** so nothing keeps billing while you sleep. Cost awareness isn't a side note here; it's the actual skill this lesson teaches, alongside the AWS mechanics. That's also why "set up a billing alarm" is part of the deliverable, not an afterthought.

---

## 🧠 Concepts you'll meet (with links to learn more)

| Concept | One-line meaning | Learn more |
|---|---|---|
| **AWS account** | Your billing relationship with Amazon; everything you create belongs to one account. | [What is AWS?](https://aws.amazon.com/what-is-aws/) |
| **IAM (Identity and Access Management)** | AWS's system for creating users/permissions instead of sharing one root login. | [IAM docs: What is IAM?](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html) |
| **AWS CLI** | A command-line program that lets your terminal talk to AWS directly. | [AWS CLI user guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html) |
| **Region** | A physical cluster of AWS data centers (e.g. `us-east-1`); resources you create live in one region. | [AWS Regions and Availability Zones](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html) |
| **Billing / cost alarms** | A CloudWatch alarm that emails you if your spend crosses a threshold. | [Create a billing alarm](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html) |
| **Access key / Secret access key** | The username+password pair the CLI uses to authenticate as an IAM user. | [IAM: Access keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html) |

---

## ✅ Before you start

**Prerequisites:** an email address, a credit card, and the backend running locally (so you know what you're about to deploy).

**Time budget for the hour:** create the AWS account (10 min) → create the admin IAM user (10) → install & configure the AWS CLI (10) → create the SSH key pair (10) → fill in `deploy/params/prod.json` (10) → test & set a billing alarm (10).

---

## 🛠 Do it, step by step

### Step 1 — Create your AWS account (~10 min)

Go to <https://aws.amazon.com> and sign up. You'll need an email address and a credit card — AWS requires a card on file even to use free-tier resources, as identity/fraud verification. The small instances this project uses cost a few dollars a month, and you'll learn exactly how to stop that spend in a moment.

> **Remember to run `./deploy.sh down` when you're done experimenting** — that's the command (covered in lesson D2) that deletes the AWS resources so they stop billing. Say it out loud now; you'll want the habit before you create anything expensive. *(All `deploy.sh` commands in this track are shell scripts — on **Windows** run them from **Git Bash** or **WSL**; macOS/Linux run them in any terminal.)*

### Step 2 — Create an admin IAM user (~10 min)

Never use the root login (the one tied to your email/password from Step 1) for day-to-day work — it has *no* limits on what it can do, so a leaked root key is the worst-case leak. Instead:

1. Sign in to the [AWS Console](https://console.aws.amazon.com/) with your root login.
2. Go to **IAM** → **Users** → **Create user**.
3. Give it a name (e.g. `ltride-admin`) and enable **programmatic access** — you want an Access key, not a console password.
4. Attach the **`AdministratorAccess`** permission policy. For a school project this is acceptable; a real production team would scope this down later. → Reference: [IAM: AdministratorAccess policy](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/AdministratorAccess.html).
5. After creation, AWS shows you an **Access key ID** and a **Secret access key** exactly once. Copy both somewhere private (a password manager, not a text file in this repo) — you cannot view the secret again after this screen closes.

**Why an IAM user instead of root:** if this key ever leaks (e.g. accidentally committed to Git — the exact mistake lesson B0 taught you to prevent), you can delete or rotate this one IAM user's key without touching your entire AWS account. Root can't be deleted; a lost root key means a much harder recovery. → Reference: [IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html).

### Step 3 — Install & configure the AWS CLI (~10 min)

The deploy scripts in this repo call the AWS CLI, so your laptop needs it installed and pointed at your new IAM user's keys.

**macOS / Linux (bash/zsh):**
```bash
cd ~/workspace/LTR-Backend/deploy
./deploy.sh validate           # this auto-installs awscli via brew if missing
aws configure                  # paste your Access key, Secret, region us-east-1, output json
```

**Windows (Git Bash / WSL):** `deploy.sh` is a shell script, so run it from **Git Bash** or **WSL** — PowerShell can't execute `.sh` directly. There's no Homebrew on Windows, so install the AWS CLI **first** (in PowerShell: `winget install -e --id Amazon.AWSCLI`, or use the [MSI installer](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)); then in Git Bash/WSL:
```bash
cd $HOME/workspace/LTR-Backend/deploy
./deploy.sh validate
aws configure                  # identical on every platform
```

**What this does & why:**
- `./deploy.sh validate` — the deploy script's own preflight check. On **macOS/Linux** it notices the AWS CLI isn't installed yet and installs it for you via Homebrew, so you don't have to hunt down the right installer. On **Windows** there's no Homebrew, so install the CLI manually first (`winget install -e --id Amazon.AWSCLI` or the MSI) and run `deploy.sh` from Git Bash/WSL. → Reference: [Installing the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).
- `aws configure` — an interactive prompt that writes your Access key ID, Secret access key, default region, and default output format to `~/.aws/credentials` and `~/.aws/config`. Every later `aws` and `deploy.sh` command reads from these files. → Reference: [Configuring the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html).
- **Region `us-east-1`:** this project's templates assume this region. A region is a physical location for your resources (e.g. Virginia, USA); mixing regions later causes "resource not found" errors that are confusing to debug. → Reference: [Regions and Availability Zones](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html).
- **Output format `json`:** how the CLI prints responses to your terminal; `json` is the default the scripts expect.

### Step 4 — Create an SSH key pair (~10 min)

Later lessons SSH into your server to check on it. That requires a key pair created *in AWS* now:

1. AWS Console → **EC2** → **Key Pairs** → **Create key pair**.
2. Name it exactly `ltride-key` (the templates in later lessons expect this name).
3. Download the file — it downloads once as `ltride-key.pem` and AWS never shows it again.
4. Move it to where the scripts expect it, and lock down its permissions:

**macOS / Linux (bash/zsh):**
```bash
mv ~/Downloads/ltride-key.pem ~/.ssh/ltride-key.pem
chmod 600 ~/.ssh/ltride-key.pem
```

**Windows (PowerShell):**
```powershell
if (-not (Test-Path $HOME\.ssh)) { New-Item -ItemType Directory $HOME\.ssh | Out-Null }
Move-Item $HOME\Downloads\ltride-key.pem $HOME\.ssh\ltride-key.pem
icacls $HOME\.ssh\ltride-key.pem /inheritance:r /grant:r "$($env:USERNAME):R"
```

**What this does & why:** `chmod 600` sets the file's permissions to "owner can read and write, nobody else can do anything" — SSH itself refuses to use a private key that's readable by other users on your machine, as a safety check against a key being casually copied by another local account. On **Windows**, `icacls ... /inheritance:r /grant:r "$($env:USERNAME):R"` is the equivalent: `/inheritance:r` strips inherited permissions and `/grant:r` grants **only** your user read — Windows OpenSSH refuses an over-permissive key the same way Unix `ssh` does. → Reference: [chmod / file permission numbers](https://en.wikipedia.org/wiki/File-system_permissions#Numeric_notation) · [icacls](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls) · [AWS: Create a key pair](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/create-key-pairs.html).

### Step 5 — Fill in `deploy/params/prod.json` (~10 min)

Open `deploy/params/prod.json` and replace the placeholder values with your real ones:

- **`AdminCidr`** — your home IP address followed by `/32`. Find your IP at <https://whatismyip.com>, then append `/32` (e.g. `203.0.113.7/32`). This tells the firewall "only allow SSH from this exact address" — the `/32` means "exactly this one IP, no range." → Reference: [CIDR notation explained](https://www.digitalocean.com/community/tutorials/understanding-ip-addresses-subnets-and-cidr-notation-for-networking).
- **`KeyName`** — `ltride-key` (must exactly match the name you gave the key pair in Step 4).
- **`DomainName` / `HostedZoneId`** — leave as placeholders for now unless you already own a domain; these are wired up in a later deploy lesson. Skipping them now doesn't block anything in this lesson.

**Why this matters now, not later:** `AdminCidr` is the single setting standing between "only I can SSH into this server" and "the whole internet can try." Getting it right here, before any server exists, means the firewall is correct from the first boot.

---

## 🧪 Prove it works — testing guide

```bash
aws sts get-caller-identity
```

**What you should see** — JSON like this, confirming the CLI is authenticated as your new IAM user (not root):

```json
{
    "UserId": "AIDAEXAMPLE1234567",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/ltride-admin"
}
```

Check the `Arn` field: it should end in `user/ltride-admin` (or whatever you named your IAM user) — **not** `:root`. If it says `:root`, you configured the CLI with your root account's keys instead of the IAM user's; go back to Step 2 and use the IAM user's Access key instead.

Also confirm your SSH key's permissions are locked down:

**macOS / Linux (bash/zsh):**
```bash
ls -l ~/.ssh/ltride-key.pem
```
**Expected:** the permission string starts with `-rw-------` (only the owner can read/write). If it shows anything more permissive (like `-rw-r--r--`), re-run `chmod 600 ~/.ssh/ltride-key.pem`.

**Windows (PowerShell):**
```powershell
icacls $HOME\.ssh\ltride-key.pem
```
**Expected:** only your own user listed, with `(R)` — no `BUILTIN\Users`, `Everyone`, or inherited entries. If others appear, re-run the `icacls ... /inheritance:r /grant:r` command from Step 4.

---

## 🚀 You're set up

There's no commit for this lesson — D0 has no code, so there's nothing to push. Here's what "done" looks like instead, and how to keep it safe:

**What's now configured:**
- An AWS account with an admin IAM user (`ltride-admin` or similar) — not root — holding the keys your laptop uses.
- The AWS CLI on your laptop, authenticated and defaulting to region `us-east-1`.
- An SSH key pair (`ltride-key`) registered in AWS and saved locally at `~/.ssh/ltride-key.pem` with owner-only permissions.
- `deploy/params/prod.json` filled in with your real `AdminCidr` and `KeyName`.

**How to avoid charges while nothing is deployed yet:** right now, D0 alone creates **no billable AWS resources** — IAM users, CLI config, and key pairs are free. Charges only start once you run `./deploy.sh up` in lesson D2. Until then, there's nothing to tear down. Once you *do* start creating infrastructure in later lessons, the habit is the same every time: run `./deploy.sh down` when you're done experimenting for the day, and re-create with `./deploy.sh up` whenever you pick the project back up.

**Set a billing alarm now, while it's easy to remember:** go to AWS Console → search "Billing" → **Budgets** → create a budget with an email alert at, say, $10 or $20. This is the safety net that emails you before a mistake (like forgetting a server running for a month) turns into a surprise bill. → Reference: [Create a billing alarm](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html).

This lesson's status is recorded like every other CR in the [CR status tracker](../../plan.md#82-cr-status-tracker), even though it's setup rather than code.

---

## 🧯 If something breaks

- **`aws sts get-caller-identity` fails with `Unable to locate credentials`** — `aws configure` didn't save correctly, or you're in a different terminal session that hasn't loaded `~/.aws/credentials`. Re-run `aws configure`.
- **The `Arn` in the identity check ends in `:root`** — you used your root account's keys instead of the IAM user's. Go back to Step 2, create/re-open the IAM user, and re-run `aws configure` with *its* Access key and Secret.
- **Wrong region errors later (`resource not found` for something you know you created)** — check `aws configure list`; if the region isn't `us-east-1`, re-run `aws configure` and set it correctly.
- **Access key stopped working ("expired" or "invalid")** — IAM access keys don't expire on a timer, but they can be deactivated or deleted. In the IAM Console, under your user's **Security credentials** tab, check the key is **Active**; if not, create a new one and re-run `aws configure`.
- **You enabled MFA on your IAM user and CLI commands now fail** — programmatic (Access key) CLI calls don't use MFA by default; if you've set up an MFA-required policy, you'll need a session token via `aws sts get-session-token` first. For this project's scope, MFA on the CLI keys isn't required — MFA on your root/console login is the higher-value protection.

---

## 📝 Recap

- You created an AWS account and, critically, an **admin IAM user** instead of using root for day-to-day work.
- You installed and configured the AWS CLI so your terminal can talk to AWS directly.
- You created and locked down an SSH key pair you'll use to log into your server in later lessons.
- You filled in your real settings (`AdminCidr`, `KeyName`) in `deploy/params/prod.json`, ready for the templates in the next lesson.
- You set up a billing alarm and learned the core cost habit for this whole track: **`./deploy.sh down` when you're not actively using it.**

---

## 📚 References

- [AWS: What is AWS?](https://aws.amazon.com/what-is-aws/)
- [IAM docs: What is IAM?](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html) and [IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS CLI: Installing](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and [Configuring](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html)
- [AWS: Regions and Availability Zones](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
- [AWS: Create a key pair](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/create-key-pairs.html)
- [Create a billing alarm with CloudWatch](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html)
- [IAM: Access keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)
- Source of truth for this lesson: [deployment guide → D0](../deployment-guide.md#d0--one-time-aws-account-setup-not-a-code-cr-but-do-it-once).

---

## ➡️ Next lesson

**[Lesson D1 — Write the CloudFormation templates](D1-cloudformation-templates.md).** You'll read (and confirm) the four CloudFormation templates that describe your network, database, server, and DNS as code. → [source CR](../deployment-guide.md#cr-d1--write-the-cloudformation-templates-the-infrastructure-code).
