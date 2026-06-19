# SDKWork Standards Tools

This directory contains executable validators for SDKWork standards.

Rules:

- Tools in this directory are standards-owned and product-neutral.
- Application repositories may call these tools through thin `package.json` scripts.
- Tools must not embed application-specific secrets, local paths, or product behavior.
