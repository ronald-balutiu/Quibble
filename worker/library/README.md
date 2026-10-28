# Server-only puzzle data

Generated known answers, reveal examples and model questions will be committed
here as part of this public source repository. The owner has explicitly accepted
that anyone can inspect them on GitHub. They are not secrets or anti-cheat data.

Import these files only from Worker code. Do not copy them into `public/` or
import them from the React app: the deployed site's static assets should not
download the complete answer library. The judge/reveal APIs expose only their
intended responses, as defined by the plan.
