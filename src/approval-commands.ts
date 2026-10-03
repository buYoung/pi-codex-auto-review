import { getSelectListTheme, type ExtensionAPI, type ExtensionCommandContext } from '@earendil-works/pi-coding-agent';
import { Container, Input, SelectList, Spacer, Text, Key, matchesKey, fuzzyFilter, type Focusable, type SelectItem } from '@earendil-works/pi-tui';
import { canonicalJson, GuardError } from './contracts.js';
import { validateSettings, type GuardSettings } from './policy/index.js';
import type { GuardController } from './tools/controller.js';
import type { ApprovalSettingsStore } from './approval-settings.js';

type ReviewModel = GuardSettings['reviewModel'];
const CURRENT_MODEL = 'current';
const modeNames = {auto_review:'Approve for me',user:'Ask for approval'} as const;
// Match the public Codex permission picker: https://learn.chatgpt.com/docs/security-administration
const approvalModes: SelectItem[] = [
  {value:'auto_review',label:modeNames.auto_review,description:'Only ask for actions detected as potentially unsafe'},
  {value:'user',label:modeNames.user,description:'Always ask to edit external files and use the internet'},
];

class ApprovalModePicker extends Container {
  private readonly list: SelectList;
  constructor(current: GuardSettings['approvalsReviewer'], finish: (value: string | undefined) => void) {
    super();
    this.addChild(new Text(`Approval mode — Current: ${modeNames[current]}`,0,0));
    this.addChild(new Spacer(1));
    this.list = new SelectList(approvalModes,approvalModes.length,getSelectListTheme(),{maxPrimaryColumnWidth:22});
    this.list.setSelectedIndex(approvalModes.findIndex(item => item.value === current));
    this.list.onSelect = item => finish(item.value);
    this.list.onCancel = () => finish(undefined);
    this.addChild(this.list);
    this.addChild(new Spacer(1));
    const description = new Text(this.list.getSelectedItem()?.description ?? '',0,0);
    this.list.onSelectionChange = item => description.setText(item.description ?? '');
    this.addChild(description);
    this.addChild(new Spacer(1));
    this.addChild(new Text('↑↓ Select · Enter Apply · Esc Cancel',0,0));
  }
  handleInput(data: string): void { this.list.handleInput(data); }
}

function availableReviewModels(context: ExtensionCommandContext) {
  const available = context.modelRegistry.getAvailable();
  const scoped = context.scopedModels ?? [];
  if (!scoped.length) return available;
  const key = (model: {provider:string;id:string}) => canonicalJson({provider:model.provider,id:model.id});
  const byIdentity = new Map(available.map(model => [key(model),model]));
  const seen = new Set<string>();
  return scoped.flatMap(({model}) => {
    const identity = key(model), registered = byIdentity.get(identity);
    if (!registered || seen.has(identity)) return [];
    seen.add(identity);
    return [registered];
  });
}

class ApprovalModelPicker extends Container implements Focusable {
  private readonly input = new Input();
  private list!: SelectList;
  private readonly results = new Container();
  private filtered: SelectItem[];
  get focused(): boolean { return this.input.focused; }
  set focused(value: boolean) { this.input.focused = value; }
  constructor(private readonly items: SelectItem[], selected: string, private readonly finish: (value: string | undefined) => void, search: string) {
    super();
    this.addChild(new Text('Approval review model',0,0));
    this.addChild(new Spacer(1));
    this.addChild(this.input);
    this.addChild(new Spacer(1));
    this.addChild(this.results);
    this.addChild(new Text('Search · ↑↓ Select · Enter Apply · Esc Cancel',0,0));
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
    this.results.addChild(this.filtered.length ? this.list : new Text('No matching models.',0,0));
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
  const models = availableReviewModels(context);
  const items: SelectItem[] = [
    {value:CURRENT_MODEL,label:'Use current Pi model',description:'Follow the model selected for the main task.'},
    ...models.map(model => ({value:canonicalJson({provider:model.provider,id:model.id}),label:model.name || model.id,description:`${model.provider}/${model.id}`})),
  ];
  const selected = current ? canonicalJson(current) : CURRENT_MODEL;
  const result = context.mode === 'rpc'
    ? await context.ui.select('Approval review model',items.map(item => `${item.label} — ${item.description}`)).then(value => value === undefined ? undefined : items[items.findIndex(item => `${item.label} — ${item.description}` === value)]?.value)
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
  pi.registerCommand('approve',{description:'Choose how actions are approved: Approve for me or Ask for approval.',handler:async(_args,context) => {
    requireUI(context);
    await context.waitForIdle();
    const current = guard.options.settings;
    const choices = approvalModes.map(item => `${item.label} — ${item.description}`);
    const choice = context.mode === 'rpc'
      ? await context.ui.select(`Approval mode — Current: ${modeNames[current.approvalsReviewer]}`,choices).then(selected => approvalModes[choices.indexOf(selected ?? '')]?.value)
      : await context.ui.custom<string | undefined>((_tui,_theme,_keys,done) => new ApprovalModePicker(current.approvalsReviewer,done));
    if (choice === undefined) return;
    const reviewer = choice === 'auto_review' ? 'auto_review' : choice === 'user' ? 'user' : undefined;
    if (!reviewer) return;
    await apply({approvalsReviewer:reviewer},context);
    context.ui.notify(`Approval mode: ${modeNames[reviewer]}`,'info');
  }});
  pi.registerCommand('approve-model',{description:'Choose an approval review model from /scoped-models.',handler:async(args,context) => {
    requireUI(context);
    await context.waitForIdle();
    const current = guard.options.settings;
    const model = await chooseReviewModel(context,current.reviewModel,args.trim());
    if (model === undefined) return;
    if (model && !availableReviewModels(context).some(candidate => candidate.provider === model.provider && candidate.id === model.id)) throw new GuardError('MODEL_UNAVAILABLE','Selected review model is no longer available in the current model scope');
    await apply({reviewModel:model},context);
    context.ui.notify(`Approval review model: ${model ? `${model.provider}/${model.id}` : 'Use current Pi model'}`,'info');
  }});
}
