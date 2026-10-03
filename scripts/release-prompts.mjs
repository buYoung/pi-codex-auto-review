import { confirm } from '@inquirer/prompts';
import { Plugin } from 'release-it';

export class ReleaseStopped extends Error {
  constructor(message) {
    super(message, { cause: 'INFO' });
    this.name = 'ReleaseStopped';
  }
}

export async function requireAnswer(pendingAnswer, stage) {
  try {
    return await pendingAnswer;
  } catch (error) {
    if (['ExitPromptError', 'AbortPromptError'].includes(error?.name)) {
      throw new ReleaseStopped(`${stage} 선택을 취소했습니다.`);
    }
    throw error;
  }
}

/** Inquirer asks at release-it's actual Git execution points. */
export class InquirerPrompt {
  prompts = new Map();
  completed = [];
  attempted = [];
  tagName;

  register(definitions, namespace = 'default') {
    this.prompts.set(namespace, { ...this.prompts.get(namespace), ...definitions });
  }

  async show({ enabled = true, prompt, namespace = 'default', task, context }) {
    if (!enabled) return false;
    const expected = ['commit', 'tag', 'push'][this.completed.length];
    const definition = this.prompts.get(namespace)?.[prompt];
    if (namespace !== 'git' || prompt !== expected || definition?.type !== 'confirm' || typeof task !== 'function') {
      throw new Error(`지원하지 않는 릴리스 질문입니다: ${namespace}.${prompt}`);
    }
    this.tagName = context.tagName;
    const messages = {
      commit: `버전 ${context.version} 릴리스 커밋을 만들까요?`,
      tag: `${context.tagName} 태그를 만들까요?`,
      push: `${context.branchName}와 ${context.tagName}을 푸시해 GitHub Actions의 npm 게시를 시작할까요?`
    };
    const answer = await requireAnswer(confirm({ message: messages[prompt], default: true }), prompt);
    if (answer !== true) throw new ReleaseStopped(`${prompt} 단계를 거절해 릴리스를 중단했습니다.`);
    this.attempted.push(prompt);
    const result = await task(answer);
    this.completed.push(prompt);
    return result;
  }
}

export default class SelectedVersionGuard extends Plugin {
  beforeBump() {
    const { version, latestVersion } = this.config.getContext();
    if (version !== this.options.selectedVersion || latestVersion !== this.options.currentVersion) {
      throw new Error('화면에서 선택한 버전과 실제 릴리스 버전이 다릅니다.');
    }
    if (this.config.isCI || this.config.isPromptOnlyVersion) {
      throw new Error('버전 선택과 Git 작업 확인을 건너뛸 수 없습니다.');
    }
  }
}
