import { Widget, WidgetInput, WidgetOutput } from '../types';

type WidgetExecutionHooks = {
  onWidgetStart?: (type: string) => void;
  onWidgetComplete?: (type: string) => void;
  onWidgetError?: (type: string) => void;
};

class WidgetExecutor {
  static widgets = new Map<string, Widget>();

  static register(widget: Widget) {
    this.widgets.set(widget.type, widget);
  }

  static getWidget(type: string): Widget | undefined {
    return this.widgets.get(type);
  }

  static async executeAll(
    input: WidgetInput,
    hooks: WidgetExecutionHooks = {},
  ): Promise<WidgetOutput[]> {
    const results: WidgetOutput[] = [];

    await Promise.all(
      Array.from(this.widgets.values()).map(async (widget) => {
        try {
          if (widget.shouldExecute(input.classification)) {
            hooks.onWidgetStart?.(widget.type);
            const output = await widget.execute(input);
            hooks.onWidgetComplete?.(widget.type);
            if (output) {
              results.push(output);
            }
          }
        } catch (e) {
          hooks.onWidgetError?.(widget.type);
          console.log(`Error executing widget ${widget.type}:`, e);
        }
      }),
    );

    return results;
  }
}

export default WidgetExecutor;
