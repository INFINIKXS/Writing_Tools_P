# Automated Codebase Security Audit Report
**Generated At**: `2026-07-25 12:45:21`  
**Total Findings**: `8` | High: `6` | Medium: `0` | Low: `2`

## Executive Summary
| Audit Stage | Status | Findings Summary |
| :--- | :--- | :--- |
| **Backend Code Security (Python Bandit SAST)** | 🟡 WARN | Bandit scanner not installed. |
| **Frontend Dependency Vulnerabilities (npm audit)** | 🔴 FAIL | Detected 16 dependency vulnerability(ies) (Critical/High: 6, Moderate: 0, Low: 2). |
| **Secret & Credentials Detection Scan** | 🟢 PASS | No exposed credentials or secrets detected. |

---

## Backend Code Security (Python Bandit SAST)
**Status**: `WARN`

Bandit static analyzer is not installed in the local environment.
Install it using `pip install bandit` to enable full Python SAST scanning.

## Frontend Dependency Vulnerabilities (npm audit)
**Status**: `FAIL`

- **Critical**: 0
- **High**: 6
- **Moderate**: 0
- **Low**: 2

### Vulnerable Packages Overview:
- **@babel/core** (`LOW`): @babel/core: Arbitrary File Read via sourceMappingURL Comment
- **brace-expansion** (`HIGH`): brace-expansion: Zero-step sequence causes process hang and memory exhaustion, brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups
- **esbuild** (`LOW`): esbuild allows arbitrary file read when running the development server on Windows
- **flatted** (`HIGH`): flatted vulnerable to unbounded recursion DoS in parse() revive phase, Prototype Pollution via parse() in NodeJS flatted
- **js-yaml** (`HIGH`): JS-YAML: Quadratic-complexity DoS in merge key handling via repeated aliases, js-yaml: YAML merge-key chains can force quadratic CPU consumption
- **picomatch** (`HIGH`): Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching, Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching
- **postcss** (`HIGH`): PostCSS has XSS via Unescaped </style> in its CSS Stringify Output, PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments
- **vite** (`HIGH`): Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling, Vite: `server.fs.deny` bypassed with queries

## Secret & Credentials Detection Scan
**Status**: `PASS`

Clean scan! No hardcoded AWS keys, private keys, or API tokens found.
