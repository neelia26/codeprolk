# CodePRO LK styles

`../styles.css` is the only stylesheet imported by the React entry point. It loads
the modules in numeric order so the existing cascade remains predictable.

## Modules

- `00-foundations.css`: font faces, design tokens, resets, and global primitives.
- `01-navigation.css`: primary site header and navigation.
- `02-account-admin-base.css`: original authentication, quiz, leaderboard, and admin foundations.
- `03-home.css`: homepage hero and homepage sections.
- `04-shell-footer-chat.css`: footer, chat widget, shared buttons, responsive shell, and global typography refinements.
- `05-roadmap.css`: journey roadmap component.
- `06-services.css`: Services page.
- `07-courses.css`: Courses page.
- `08-about.css`: About page.
- `09-terms.css`: Terms page.
- `10-disclaimer.css`: Disclaimer page.
- `11-privacy.css`: Privacy page and its later visual refinement.
- `12-contact.css`: Contact page.
- `13-quiz-auth-leaderboard.css`: later Quiz, authentication, and Leaderboard refinements, including live comments.
- `14-blog-legacy.css`: original Blog rules retained for compatibility with admin publishing controls.
- `15-navigation-refinements.css`: active navigation state and mobile navigation fixes.
- `16-profile.css`: profile menu and Profile page.
- `17-admin-final.css`: final Admin width alignment.
- `18-blog.css`: current cinematic Blog experience and its interactions.

## Conventions

1. Put page-specific additions in that page's module.
2. Put shared tokens and font declarations in `00-foundations.css`.
3. Keep imports in numeric order unless intentionally changing cascade priority.
4. Prefer extending an existing rule over appending another override at the end.
5. Keep selectors scoped to the page root, such as `.about-page` or `.cp-blog`.
6. Include responsive and reduced-motion rules beside the feature they control.

The legacy Blog module can be reduced gradually as its remaining admin-publisher
rules are migrated into `18-blog.css`. It stays in place for now to preserve the
current production behavior.
