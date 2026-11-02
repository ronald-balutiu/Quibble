import { z } from 'zod'

// Every schema imports Zod from here. The browser's content security policy
// forbids eval (3.11), and Workers do too, so Zod is told not to compile
// validators with `new Function`. Otherwise it probes for eval on first use, and
// the browser reports a policy violation.
z.config({ jitless: true })

export { z }
