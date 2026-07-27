import os

files = [
    'frontend/src/components/PrivacyView.jsx',
    'frontend/src/components/TermsView.jsx',
    'frontend/src/components/CookiePolicyView.jsx',
    'frontend/src/components/CopyrightPolicyView.jsx',
    'frontend/src/components/CommunityGuidelinesView.jsx',
    'frontend/src/components/PremiumView.jsx',
    'frontend/src/components/SettingsView.jsx'
]

for filename in files:
    file = os.path.abspath(filename)
    if not os.path.exists(file):
        print(f'Missing {file}')
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    replacements = {
        # Buttons first
        "'bg-amber-500/10 border border-amber-500/20 text-white shadow-[0_0_15px_rgba(245,158,11,0.05)]'": "'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]'",
        "'bg-amber-500/10 border border-amber-500/20 text-slate-900 dark:text-white shadow-[0_0_15px_rgba(245,158,11,0.05)]'": "'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]'",
        "'border border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'": "'border border-transparent text-slate-600 dark:text-neutral-400 hover:bg-slate-200/50 dark:hover:bg-neutral-900/40 hover:text-slate-900 dark:hover:text-neutral-200'",
        "'border border-transparent text-slate-600 dark:text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'": "'border border-transparent text-slate-600 dark:text-neutral-400 hover:bg-slate-200/50 dark:hover:bg-neutral-900/40 hover:text-slate-900 dark:hover:text-neutral-200'",
        
        # Simple replaces
        "bg-neutral-950/80": "bg-white/80 dark:bg-neutral-950/80",
        "bg-neutral-950/40": "bg-white/80 dark:bg-neutral-950/80",
        "bg-neutral-900/50": "bg-white/60 dark:bg-neutral-900/50",
        "bg-neutral-900/30": "bg-slate-100 dark:bg-neutral-900/30",
        "bg-neutral-900": "bg-slate-200 dark:bg-neutral-900",
        "border-neutral-900": "border-slate-200 dark:border-neutral-900",
        "text-white": "text-slate-900 dark:text-white",
        "text-neutral-400": "text-slate-600 dark:text-neutral-400",
        "text-neutral-300": "text-slate-600 dark:text-neutral-400",
        "bg-black": "bg-slate-50 dark:bg-black",
    }

    for old, new in replacements.items():
        content = content.replace(old, new)
        
    # Fix up any doubles we caused
    cleanups = {
        "text-slate-900 dark:text-slate-900 dark:text-white": "text-slate-900 dark:text-white",
        "text-slate-600 dark:text-slate-600 dark:text-neutral-400": "text-slate-600 dark:text-neutral-400",
        "bg-slate-50 dark:bg-slate-50 dark:bg-black": "bg-slate-50 dark:bg-black",
        "border-slate-200 dark:border-slate-200 dark:border-neutral-900": "border-slate-200 dark:border-neutral-900",
        "bg-slate-200 dark:bg-slate-200 dark:bg-neutral-900": "bg-slate-200 dark:bg-neutral-900",
        "bg-white/80 dark:bg-white/80 dark:bg-neutral-950/80": "bg-white/80 dark:bg-neutral-950/80",
        "bg-white/60 dark:bg-white/60 dark:bg-neutral-900/50": "bg-white/60 dark:bg-neutral-900/50",
        "bg-slate-100 dark:bg-slate-100 dark:bg-neutral-900/30": "bg-slate-100 dark:bg-neutral-900/30",
        
        # specifically fix border-slate-200 dark:bg-slate-200 dark:border-neutral-900
        # Wait, if "border-neutral-900" is replaced, it's fine.
        # But what if "bg-neutral-900/50" became "bg-slate-200 dark:bg-neutral-900/50" first? We should order our replacements!
    }
    for old, new in cleanups.items():
        content = content.replace(old, new)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Processed {file}')
