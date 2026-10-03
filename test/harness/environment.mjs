// Runs before Pi imports in each isolated test process.
// Provider discovery only sees synthetic configuration explicitly supplied by fixtures.
const keep=new Set(['PATH','LANG','LC_ALL','LC_CTYPE','TZ','TERM','TMPDIR','NODE_TEST_CONTEXT','NODE_CHANNEL_FD','NODE_CHANNEL_SERIALIZATION_MODE','PI_GUARD_RUN_DIR','PI_GUARD_KERNEL_ARCH']);
for(const key of Object.keys(process.env))if(!keep.has(key))delete process.env[key];
