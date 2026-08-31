# Building a Car Insurance Onboarding Flow

Build a digital experience for car insurance onboarding — comprehensive or mandatory — including a supporting API and cloud deployment.

- **Part A** — Build and deploy a small API service that wraps the vehicle-info endpoint.
- **Part B** — Build a working conversational flow on the Insait platform that uses your API.

**Presentation:** in a personal meeting — prepare a presentation and demo of your solution.

---

## Part A — Technical Specification

### Endpoint

```
https://insurance-webhook-945894769129.us-central1.run.app/docs
```

### Request

```json
{ "license_plate": "12345678" }
```

### Success Response

```json
{
  "success": true,
  "data": {
    "license_plate": "12345678",
    "manufacturer": "Toyota",
    "model": "Corolla",
    "year": 2020,
    "color": "White"
  }
}
```

### curl Example

```bash
curl -X POST \
  https://insurance-webhook-945894769129.us-central1.run.app/vehicle-info \
  -H "Content-Type: application/json" \
  -d '{"license_plate": "12345678"}'
```

Response:
```json
{"success":true,"data":{"license_plate":"12345678","manufacturer":"Toyota","model":"Corolla","year":2020,"color":"White"}}
```

**Task:** Build a small API service that wraps this vehicle-info endpoint, and deploy it to the cloud.

---

## Part B — Building the Flow on the Insait Platform

Build a working flow on the Insait platform for car insurance onboarding.

- Log in at [platform.gainencore.ai](https://platform.gainencore.ai) and register.

### Use a Conversation Flow Agent

When creating the agent, choose **Conversation Flow Agent** ("Multi-step flows with branching logic"), not Single Prompt Agent. You'll build the onboarding as a flow graph — the user experiences a natural conversation, while the graph guarantees every required step happens.

### Two Approaches — Strict and Agentic

The platform supports two complementary ways of moving a conversation forward and capturing data:

- **Strict (deterministic)** — you define exactly what to collect and exactly how to branch. Predictable, testable, and guaranteed: ideal for compliance-critical steps, API inputs, and validation. Trade-off: more scripted feel.
- **Agentic (conversational)** — built with a **conversation node** plus tools such as **save field** and **LLM exits**: give the agent a goal and let the LLM run a natural dialogue, saving details as they come up and exiting when a described condition is met (e.g. *"the customer confirmed the vehicle details"*). Handles users who volunteer everything at once, ask side questions, or answer out of order. Trade-off: less determinism.

In node terms:
- **Collect nodes** with typed, validated fields + **expression edges** → the strict toolkit
- **Conversation nodes** with saved fields + **LLM-evaluated exit conditions** → the agentic toolkit
- **API nodes** → call your service, with success/error routing

Real production flows mix both — e.g. a strict opening, an agentic middle, a strict finish around the API call. How you split your flow between them is **your call** — there is no single correct answer. Be ready to explain the reasoning behind each choice.

### Flow Steps

1. **Opening** — welcome message; select insurance type (Comprehensive / Mandatory).
2. **Vehicle details** — collect license plate number; **call the API built in Part A**; display vehicle details for confirmation; handle errors (vehicle not found).
3. **Customer details** — full name, phone number (with validation), email (with validation).
4. **Additional coverage (Comprehensive only)** — windshield, extended third-party, replacement vehicle; multi-select.
5. **Summary & confirmation** — display all details; final confirmation.

### Technical Requirements

- [ ] Agent created as a **Conversation Flow Agent** (flow graph — not Single Prompt).
- [ ] API integration — success **and** error paths handled.
- [ ] Conditions for dynamic routing: deterministic edges where the branch is business logic; LLM-evaluated exits where the judgment is conversational.
- [ ] Data stored in variables, from both collect nodes and agentic saved fields.
- [ ] Input validation.
- [ ] Error handling: API not responding, validation failed, vehicle not found.

---

## Submission

- [ ] Link to the flow, workspace name, and agent name.
- [ ] A **~3-minute video recording** of you explaining the flow and running a happy path end to end.

> **Build it yourself:** You will be asked technical questions on the flow in the interview — why each node is the type it is, how the API integration works, what happens when the user goes off-script or the API fails. Make sure you build the flow yourself and know every part of it.

---

## Working Checklist

- [ ] Part A: API service wrapping vehicle-info endpoint, deployed to cloud
- [ ] Part A: Handle success + not-found / error responses
- [ ] Part B: Insait account registered at platform.gainencore.ai
- [ ] Part B: Conversation Flow Agent created
- [ ] Part B: Opening step (insurance type selection)
- [ ] Part B: Vehicle details step (license plate → API call → confirmation)
- [ ] Part B: Customer details step (name, phone, email with validation)
- [ ] Part B: Additional coverage step (Comprehensive only, multi-select)
- [ ] Part B: Summary & confirmation step
- [ ] Error handling across flow (API down, validation failure, vehicle not found)
- [ ] Prepare explanation of strict vs. agentic node choices for each step
- [ ] Record ~3-minute demo video (happy path, end to end)
- [ ] Prepare submission: flow link, workspace name, agent name
