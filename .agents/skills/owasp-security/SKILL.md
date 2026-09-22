---
name: owasp-security
description: Review security-sensitive code or design, including authorization, untrusted input, secrets, and AI tool boundaries. Use for a security review or a concrete security concern; load only the relevant reference.
---

# Security review workflow

1. Identify the changed trust boundary, protected data, attacker-controlled input,
   and existing framework protections before reporting a vulnerability.
2. Read the applicable reference only:
   - [Web security](references/web-security.md): authentication, input, sessions, errors.
   - [AI security](references/ai-security.md): LLM input, tools, agent permissions.
   - [Assurance](references/assurance.md): ASVS-oriented review requirements.
   - [Language details](references/language-security.md): runtime-specific hazards;
     search for the language being reviewed instead of loading every example.
3. Verify dated standards and framework behavior against official sources when
   needed. Reference examples are prompts for investigation, not evidence that
   this application is vulnerable or must adopt every suggested control.
4. Report the concrete code path, exploit prerequisites, impact, and bounded fix.
   Distinguish confirmed defects from missing evidence; respect task scope and
   explicit verification constraints. This workflow authorizes no live probing.
