import { getSelectListTheme, type ExtensionAPI, type ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { Container, Input, SelectList, Spacer, Text, Key, matchesKey, fuzzyFilter, type Focusable, type SelectItem } from '@earendil-works/pi-tui';
import { canonicalJson, GuardError } from './contracts.js';
import { validateSettings, type GuardSettings } from './policy/index.js';
import type { GuardController } from './tools/controller.js';
import type { ApprovalSettingsStore } from './approval-settings.js';

type ReviewModel = GuardSettings['reviewModel'];
const CURRENT_MODEL = 'current';
const modeNames = {auto_review:'Approve for me',user:'Ask for approval'} as const;

class ApprovalModelPicker extends Container implements Focusable {
  private readonly input = new Input();
  private list!: SelectList;
  private readonly results = new Container();
  private filtered: SelectItem[];
  get focused(): boolean { return this.input.focused; }
  set focused(value: boolean) { this.input.focused = value; }
  constructor(private readonly items: SelectItem[], selected: string, private readonly finish: (value: string | undefined) => void, search: string) {
    super();
    this.addChild(new Text('승인 검토 모델 선택',0,0));
    this.addChild(new Spacer(1));
    this.addChild(this.input);
    this.addChild(new Spacer(1));
    this.addChild(this.results);
    this.addChild(new Text('검색 · ↑↓ 선택 · Enter 적용 · Esc 취소',0,0));
    this.filtered = items;
    this.input.setValue(search);
    this.filter(search);
    const index = this.filtered.findIndex(item => item.value === selected);
    if (index >= 0) this.list.setSelectedIndex(index);
  }
  private filter(query: string): void {
    this.filtered = query ? fuzzyFilter(this.items,query,item => `${item.label} ${item.description ?? ''}`) : this.items;
    this.list = new SelectList(this.filtered,12,getSelectListTheme());
    this.list.onSelect = item => this.finish(item.value);
    this.list.onCancel = () => this.finish(undefined);
    this.results.clear();
    this.results.addChild(this.filtered.length ? this.list : new Text('일치하는 모델이 없습니다.',0,0));
  }
  handleInput(data: string): void {
    if (matchesKey(data,Key.escape)) this.finish(undefined);
    else if (matchesKey(data,Key.enter) || matchesKey(data,Key.up) || matchesKey(data,Key.down)) this.list.handleInput(data);
    else {
      const before = this.input.getValue();
      this.input.handleInput(data);
      if (this.input.getValue() !== before) this.filter(this.input.getValue());
    }
  }
}

async function chooseReviewModel(context: ExtensionCommandContext, current: ReviewModel, search: string): Promise<ReviewModel | undefined> {
  const models = context.modelRegistry.getAvailable();
  const items: SelectItem[] = [
    {value:CURRENT_MODEL,label:'현재 Pi 모델 사용',description:'주 작업 모델의 선택을 따릅니다.'},
    ...models.map(model => ({value:canonicalJson({provider:model.provider,id:model.id}),label:model.name || model.id,description:`${model.provider}/${model.id}`})),
  ];
  const selected = current ? canonicalJson(current) : CURRENT_MODEL;
  const result = context.mode === 'rpc'
    ? await context.ui.select('승인 검토 모델 선택',items.map(item => `${item.label} — ${item.description}`)).then(value => value === undefined ? undefined : items[items.findIndex(item => `${item.label} — ${item.description}` === value)]?.value)
    : await context.ui.custom<string | undefined>((_tui,_theme,_keys,done) => new ApprovalModelPicker(items,selected,done,search));
  if (result === undefined) return undefined;
  return result === CURRENT_MODEL ? null : JSON.parse(result) as ReviewModel;
}

export function registerApprovalCommands(pi: ExtensionAPI, guard: GuardController, store: ApprovalSettingsStore): void {
  const requireUI = (context: ExtensionCommandContext) => {
    if (!context.hasUI) throw new GuardError('APPROVAL_UI_UNAVAILABLE','Approval settings require an interactive Pi session');
  };
  const apply = async (patch: Partial<Pick<GuardSettings,'reviewModel'|'approvalsReviewer'>>, context: ExtensionCommandContext) => {
    await guard.updateSettings(current => validateSettings({...current,...patch}),context.cwd,settings => store.save(settings));
    context.ui.setStatus('auto-review',undefined);
  };
  pi.registerCommand('approve',{description:'Approve for me 또는 Ask for approval 승인 방식을 설정합니다.',handler:async(_args,context) => {
    requireUI(context);
    await context.waitForIdle();
    const current = guard.options.settings;
    const choice = await context.ui.select(`실행 승인 방식 — 현재 ${modeNames[current.approvalsReviewer]}`,Object.values(modeNames));
    if (choice === undefined) return;
    const reviewer = choice === modeNames.auto_review ? 'auto_review' : choice === modeNames.user ? 'user' : undefined;
    if (!reviewer) return;
    await apply({approvalsReviewer:reviewer},context);
    context.ui.notify(`승인 방식: ${modeNames[reviewer]}`,'info');
  }});
  pi.registerCommand('approve-model',{description:'승인 검토에 사용할 보조모델을 선택합니다.',handler:async(args,context) => {
    requireUI(context);
    await context.waitForIdle();
    const current = guard.options.settings;
    const model = await chooseReviewModel(context,current.reviewModel,args.trim());
    if (model === undefined) return;
    if (model && !context.modelRegistry.find(model.provider,model.id)) throw new GuardError('MODEL_UNAVAILABLE','Selected review model is no longer registered');
    await apply({reviewModel:model},context);
    context.ui.notify(`승인 검토 모델: ${model ? `${model.provider}/${model.id}` : '현재 Pi 모델 사용'}`,'info');
  }});
}
