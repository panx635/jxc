# 针式连续纸（两联）与 A4：打印技术方案调研

> **为什么放这里**：仓库目前只有 `docs/agents/`，没有 research 目录或命名惯例；因此按「日期-主题」新建 `docs/research/`，作为同类调研的落点，后续研究同目录按日期追加。
>
> - 票：#8「针式与 A4 打印方案调研」｜分支：`research/print-format`｜日期：2026-11-21
> - 范围：只回答「技术上怎么做到、边界在哪」，不设计产品与界面。
> - 方法：读 W3C/WHATWG 规范、MDN（含其 Browser Compat Data）、Chromium 源码；在 Edge 157（Chromium 157）headless 上做打印实测（方法与用例见附录 A）。
> - 标注：**【已验证】** = 查过规范/源码，或本地实测；**【据文档推断】** = 由多个一手来源推得、未逐条实测。

---

## 0. 结论先行

1. **一套 HTML+CSS 模板同时喂针式与 A4，是成本最低且被浏览器原生支持的路线。** `@page { size: <length>{1,2} }` 接受任意毫米纸型，Chromium 自 Chrome 15 起支持；实测 `@page{size:241mm 93mm;margin:0}` 输出的 PDF 页面恰为 683.04×264 pt（=241×93.1 mm），93 mm 内容单页装下、无空白页。**【已验证】**（[size 语法](https://drafts.csswg.org/css-page-3/#page-size-prop)、[BCD: Chrome 15](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/page.json)、附录 A 用例 1/2）
2. **针式套打用「固定页面盒 + 零边距 + 容器 `position: relative` + 子元素 `position: absolute`」，坐标精度上限是 1 CSS px（0.265 mm）。** 实测 `left:30mm; top:20mm` 的方块落在 113 px / 76 px（29.9 mm / 20.1 mm），误差 <0.15 mm。代价是绝对定位盒**不参与分页**——规范明确 break 属性不得作用于绝对定位盒，所以针式版式里不要放会被分页的长表格。**【已验证】**（[CSS Break 3 §3.1/§3.2](https://drafts.csswg.org/css-break-3/#break-between)、附录 A 用例 5）
3. **三个必然翻车的坑：页边距不选「默认」就不吃 CSS margin、缩放不是 100% 就一定错位、`break-after: always` 在 Chromium 里是死值。** Chromium 源码里 `ignore_css_margins_ = margins_type != kDefaultMargins`；缩放默认是「fit 到纸张」而非 1:1；实测 `break-after:always` 不分页、`break-after:page` 分页。**【已验证】**（[print_render_frame_helper.cc](https://chromium.googlesource.com/chromium/src/+/main/components/printing/renderer/print_render_frame_helper.cc)、[PrintScalingOption](https://chromium.googlesource.com/chromium/src/+/main/printing/mojom/print.mojom)、附录 A 用例 4/7）
4. **A4 多页可以直接交给流式排版，但要显式写规则。** 实测 `<thead>` 在每一页重复（3 页全有表头）、`break-inside: avoid` 对 `<div>` 和 `<tr>` 都生效（对照组会把盒子切开）；但 avoid 只是「尽量避免」，内容本身高于一页时规范允许放弃约束。**【已验证】**（[CSS 2.1 表格模型](https://www.w3.org/TR/CSS21/tables.html)、[CSS Break 3 §4.4](https://drafts.csswg.org/css-break-3/#unforced-breaks)、附录 A 用例 6/8/9）
5. **服务端 PDF 不是「浏览器打印」的替代品，而是归档/补打/一致输出的补位；pdfmake、pdf-lib 只在决定彻底离开浏览器排版时才值得。** Puppeteer 复用同一套 CSS 打印语义并可用 `preferCSSPageSize` 锁 1:1；pdfmake 自带布局引擎但默认只带 Roboto（中文要自带 TTF/TTC）；pdf-lib 是画布库、没有布局引擎，标准字体只有 WinAnsi、不能放中文。**【据文档推断】**（[Puppeteer PDFOptions](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.pdfoptions.md)、[pdfmake Printer.js](https://github.com/bpampuch/pdfmake/blob/master/src/Printer.js)、[pdf-lib README](https://github.com/Hopding/pdf-lib/blob/master/README.md)）

### 推荐方案（一句话版）

**模板 = 一份 JSON 配置（字段/logo/表尾/排序/联次文案）+ 一个 React 渲染器输出 HTML+CSS；同一份 HTML 出两套打印版式（A4 流式 / 针式绝对定位套打）。A4 走浏览器 `window.print()`，针式走浏览器 + 驱动里预置「241×93 连续纸」纸型 + 页边距「默认」+ 缩放 100%；服务端只做「归档/补打」的 Chromium PDF（Puppeteer `preferCSSPageSize:true, printBackground:true`），不复刻第二套排版。**

---

## 1. CSS `@page` / `size` / `margin` 的现代 Chromium 边界

### 1.1 支持矩阵（以 Chromium 为准）

| 能力 | Chromium 起始版本 | 说明 | 依据 |
| --- | --- | --- | --- |
| `@page` 基础 | 2 | 页面上下文与页面选择器；`@page :first` 实测可单独改纸型（用例 11） | [BCD](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/page.json) |
| `size` 描述符 | 15 | 关键字或 `<length>{1,2}` | [BCD](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/page.json)、[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@page/size) |
| 命名页 `page` 属性 | 85 | 不同页可套不同 `@page` | [BCD](https://github.com/mdn/browser-compat-data/blob/main/css/properties/page.json) |
| `page-orientation` | 85 | 布局之后整体旋转的权宜手段 | [BCD](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/page.json) |
| 页边距盒 `@top-left` 等 | 131 | 只有 Chrome 有，Firefox/Safari 均无 | [BCD](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/page.json) |
| `page-margin-safety` | 150 | 让 UA 把不可打印区算进页边距 | [BCD](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/page.json)、[规范 §7.6](https://drafts.csswg.org/css-page-3/#page-margin-safety) |
| `break-inside` | 50 | 对 `div`/`tr` 实测有效 | [BCD](https://github.com/mdn/browser-compat-data/blob/main/css/properties/break-inside.json) |
| `break-after/before` | 50 | 但 `always` 未实现（见 1.4） | [BCD](https://github.com/mdn/browser-compat-data/blob/main/css/properties/break-after.json) |
| `print-color-adjust`（无前缀） | 136 | 之前要 `-webkit-print-color-adjust` | [BCD](https://github.com/mdn/browser-compat-data/blob/main/css/properties/print-color-adjust.json)、[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/print-color-adjust) |

> 桌面目标只锁 Chrome/Edge 时，上表全是可用项；但**页边距盒（131+）与 `page-margin-safety`（150+）不能作为基础能力**——员工机、老版本 Edge、国产双核浏览器都可能没有。

### 1.2 针式纸型怎么表达

规范定义：`size: <length [0,∞]>{1,2} | auto | [ <page-size> || [ portrait | landscape ] ]`，两个长度依次是**页面盒的宽和高**，只给一个值时宽高相同，负值非法。**【已验证】**（[CSS Page 3 §7.1](https://drafts.csswg.org/css-page-3/#page-size-prop)、[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@page/size)）

所以 241 mm × 93 mm 的连续纸就是：

```css
@page { size: 241mm 93mm; margin: 0; }
```

实测输出 PDF 的 MediaBox 为 `[0 0 683.04 264]` pt = **241.0 mm × 93.1 mm**（1 mm = 2.8346 pt；Skia 会把页面尺寸取整到 pt）。同一份文档 120 mm 内容 → 2 页。**【已验证】**（附录 A 用例 1/2；[CSS Values 4：1px=1/96in，1mm=96px/25.4](https://www.w3.org/TR/css-values-4/#absolute-lengths)）

两个容易忽略的规范细节：
- **被媒体查询限定的 `size` 会被忽略**：`@media (max-width: 6in) { @page { size: letter } }` 里的声明无效，因为媒体查询按「未指定 @page 时的纸型」求值。**【已验证】**（[§7.1](https://drafts.csswg.org/css-page-3/#page-size-prop)）
- `@page` 里**不要用 vh/vw 等视口单位**（W3C 仍在讨论其求值语义）。**【已验证】**（[MDN @page](https://developer.mozilla.org/en-US/docs/Web/CSS/@page)）

### 1.3 页边距：谁说了算

这是套打错位的第一大来源。

- 打印设置里 **Margins = 默认（Default）** 时，Chromium 才使用样式表里的 `@page { margin }`；选「无 / 最小 / 自定义」会**整体忽略 CSS 页边距**。源码是一行：`ignore_css_margins_ = margins_type != kDefaultMargins`。**【已验证】**（[print_render_frame_helper.cc · UpdateFrameMarginsCssInfo](https://chromium.googlesource.com/chromium/src/+/main/components/printing/renderer/print_render_frame_helper.cc)）
- 「默认」在 CSS 没写 margin 时的实际值：**四边各 1 cm**；并且**某一物理边小于 1 英寸（25.4 mm）时，该方向边距取 0**。源码注释与实现都在 `PrintSettings::SetPrinterPrintableArea`。**【已验证】**（[print_settings.cc](https://chromium.googlesource.com/chromium/src/+/main/printing/print_settings.cc)）
  - 对 93 mm 高的针式纸：93 mm > 25.4 mm，所以「默认」确实会吃 1 cm 边距 → **套打必须显式 `margin: 0`，且用户不能把边距改成非默认**。
- Margins = 「最小（Minimum）」对应 `kPrintableAreaMargins`：CSS 侧边距全部按 0 布局，交给打印机可打印区决定。**【已验证】**（[printing/mojom/print.mojom · MarginType](https://chromium.googlesource.com/chromium/src/+/main/printing/mojom/print.mojom)、[print_settings.cc](https://chromium.googlesource.com/chromium/src/+/main/printing/print_settings.cc)）
- CDP `Page.printToPDF` 的 `marginTop/Bottom/Left/Right` **默认 1 cm**，显式传 0 才得到 0。**【已验证】**（[CDP Page.pdl · printToPDF](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/public/devtools_protocol/domains/Page.pdl)）

### 1.4 分页与断行：哪些能用、哪些是死值（实测）

| 写法 | 实测结果 | 结论 |
| --- | --- | --- |
| `break-after: page` | 强制换页（1→2 页） | 可用 |
| `break-after: always` | **完全没有效果**（仍 1 页） | 死值，别用 |
| `break-after: auto` | 不换页 | 正常 |
| `break-inside: avoid`（div） | 30 mm 盒子整体移到第 2 页；去掉后跨页切开 | 有效 |
| `break-inside: avoid`（`<tr>`） | 40 mm 行整体移到第 2 页；去掉后跨页切开 | 有效 |
| `<thead>` | 3 页全部重复表头 | 有效 |

依据：附录 A 用例 4/6/7/8/9；BCD 对 `break-after: always` 明确记 `chrome: false`（[BCD](https://github.com/mdn/browser-compat-data/blob/main/css/properties/break-after.json)）。

规范层面必须知道的四条：
- `break-*` **不得作用于绝对定位盒**；`break-inside` 也不适用于绝对定位盒、行内盒、表格列盒。**【已验证】**（[CSS Break 3 §3.1/§3.2](https://drafts.csswg.org/css-break-3/#break-between)）
- avoid 是「尽量」：当断点不够用时，规范允许依次放弃 orphans/widows、再放弃 avoid 规则。所以**内容本身高于一页时，任何 avoid 都拦不住切开**。**【已验证】**（[§4.4](https://drafts.csswg.org/css-break-3/#unforced-breaks)）
- 遗留别名：`page-break-after: always` 按规范映射为 `break-after: page`（[§3.4](https://drafts.csswg.org/css-break-3/#page-break-properties)）。Chromium 长期支持 `page-break-*`，但**我实测的是 `break-*`**，写代码时统一用 `break-after: page` 更稳。
- 表格表头重复在 CSS 2.1 里是「print UA **may** repeat」，不是 must；Chromium 当前会重复，但这是实现行为，不要把它当规范保证。**【已验证】**（[CSS 2.1 表格模型](https://www.w3.org/TR/CSS21/tables.html)）

### 1.5 `@page` 做不到的事（重要边界）

- **页面级的背景色/边框/字体等属性，目前没有任何 UA 实现**；MDN 明说「以下属性尚未被任何 UA 支持」（背景、边框、color、font、padding、width 等一长串）。要底色只能在页面盒内部自己铺。**【已验证】**（[MDN @page](https://developer.mozilla.org/en-US/docs/Web/CSS/@page)）
- 页边距盒（`@top-center` 等）只有 Chrome 131+ 有；用它放页码/联次标签会牺牲 Firefox/Safari 兼容。**【已验证】**（[BCD](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/page.json)）
- `page-orientation` 是「布局完再转 90°」的补丁，规范自己说高质量实现应该用 `size` 而不是它。**【已验证】**（[§7.1.2](https://drafts.csswg.org/css-page-3/#page-orientation-prop)）

### 1.6 一份文档混两种纸型：能做，但只在 PDF 里成立

- 命名页 + 逐页 `size`：实测同一份 HTML 里 `@page a4 { size: A4 }` 与 `@page receipt { size: 241mm 93mm }` 各自生效，输出的 PDF **逐页 MediaBox 不同**（A4 = 594.96×841.92 pt，针式 = 683.04×264 pt）；`@page :first { size: A4 }` 也能只改第一页。**【已验证】**（附录 A 用例 10/11；[CSS Page 3 §8.1](https://drafts.csswg.org/css-page-3/#using-named-pages)）
- 但**物理打印一个作业只有一个纸型**：Chromium 的 `PrintParams` 里 `page_size`、`printable_area` 都是单值（注释写明「Physical size of the page, including non-printable margins」）。所以「一份文档里又有 A4 又有针式」只能拿去存 PDF，不能指望一台针式机连着打两种纸。**【已验证】**（[printing/mojom/print.mojom · PrintParams](https://chromium.googlesource.com/chromium/src/+/main/printing/mojom/print.mojom)）

---

## 2. 套打对齐

### 2.1 坐标模型

规范说：**第一页 page area 的四条边构成文档的初始包含块**（"The edges of the page area on the first page establish the rectangle that is the initial containing block of the document."）。所以打印里可以这样建立一套「纸面坐标系」：**【已验证】**（[CSS Page 3 §3 页面模型](https://drafts.csswg.org/css-page-3/#page-model)）

```css
@page { size: 241mm 93mm; margin: 0; }
.sheet { position: relative; width: 241mm; height: 93mm; overflow: hidden; }
.field { position: absolute; }       /* left/top 直接用 mm 写 */
```

实测：`.field{left:30mm; top:20mm; width:10mm; height:10mm}` 在 PDF 内容流里是 `113 76 38 37 re`（单位 CSS px），即 **29.9 mm / 20.1 mm / 10.0 mm / 9.8 mm**，与设定值误差 <0.15 mm。**【已验证】**（附录 A 用例 5）

### 2.2 精度上限：1 CSS px = 0.265 mm

- 打印的几何单位是 CSS px（1 px = 1/96 in），Skia 写 PDF 时按整数 px 落坐标 → **理论量化误差 ±0.13 mm**（实测 30 mm 变成 29.9 mm 正是这个量级）。**【已验证】**（[CSS Values 4](https://www.w3.org/TR/css-values-4/#absolute-lengths)、附录 A 用例 5）
- 结论：**位置全部用 mm 写**，别手工换算 px；0.1 mm 级的微调在 CSS 里没有意义，需要更准就得改打印机偏移或换方案（PDF 库直接写 pt）。**【据文档推断】**
- 不要用 `transform: scale()` 做「整体微调」：它会等比缩放文字与线宽，反而让套打对不齐；要对齐就改容器尺寸或坐标。**【据文档推断】**

### 2.3 缩放：套打的第二大坑

纸张和页面盒不一致时，规范给的兜底顺序是：**换更大的纸 → 旋转 90° → 缩放页面盒 → 切片 → 裁掉溢出**（按优先级）。也就是说浏览器在「纸型不匹配」时**会自己缩放或裁剪**，你的绝对坐标立刻失效。**【已验证】**（[CSS Page 3 §7.4](https://drafts.csswg.org/css-page-3/#renderingpages)）

Chromium 侧的缩放档位（源码枚举注释，直译）：

| 值 | 行为 |
| --- | --- |
| `kNone` | 不缩放，左上角对齐，超出部分裁掉 |
| `kFitToPrintableArea` | 缩放到可打印区 |
| `kSourceSize` | **按源页面尺寸 1:1，不缩放/不居中/不适配** |
| `kFitToPaper` | 缩放到所选纸张 |
| `kCenterShrinkToFitPaper` | 居中，只有比纸大才缩小（永不放大） |

**【已验证】**（[printing/mojom/print.mojom · PrintScalingOption](https://chromium.googlesource.com/chromium/src/+/main/printing/mojom/print.mojom)）

- CDP/Puppeteer 里 `preferCSSPageSize: true` 会被翻译成 `kSourceSize`（源码：`print_scaling_option = params.prefer_css_page_size ? kSourceSize : scaling_option`），这就是「1:1 套打」的开关；默认 false 时**内容会被缩放到纸张**。**【已验证】**（[print_render_frame_helper.cc](https://chromium.googlesource.com/chromium/src/+/main/components/printing/renderer/print_render_frame_helper.cc)、[CDP Page.pdl](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/public/devtools_protocol/domains/Page.pdl)）
- 浏览器打印对话框里对应的是「缩放」下拉：默认值不是 100%，必须让用户选 100%（自定义 100%）。**【据文档推断】**（由 `kFitToPrintableArea/kCenterShrinkToFitPaper` 为默认路径推出；对话框文案随版本变化，未逐版本核对）

### 2.4 不可打印边距

- 规范承认「多数打印机四边都有不可打印区，且不同边宽度不同、进纸方向还可能被打印机自行旋转」，因此提供 `page-margin-safety: none | clamp | add`：`clamp` 取「设定值」与「安全可打印内缩」的较大者，`add` 取两者之和。**【已验证】**（[CSS Page 3 §7.6](https://drafts.csswg.org/css-page-3/#page-margin-safety)）
- Chromium 侧：`page-margin-safety` 在 Chrome 150 落地（BCD）；Blink 里对应特性开关 `CSSSafePrintableInset`（status: stable），我实测 Edge 157 的 `CSSPageRule.style` 能读回 `page-margin-safety: clamp`。**【已验证】**（[BCD](https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/page.json)、[runtime_enabled_features.json5](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/runtime_enabled_features.json5)、附录 A 用例 12）
- 但**老版本没有这个能力**，现实中套打是「标定 + 偏移」：固定机型、固定驱动、固定纸型后，打印一张校准页量出实际偏移，把偏移写进模板（或用驱动里的纸张偏移）。这是操作流程问题，不是 CSS 能完全解决的。**【据文档推断】**
- 目标机型的不可打印区数值必须按机型实测，本调研不给数字（附录 A 的方法可直接复用）。

### 2.5 颜色与 logo

- `print-color-adjust: exact` 表示「不要为省墨改我的颜色」；但 MDN 明确：**用户/UA 的打印选项优先级高于该属性**，不保证生效。**【已验证】**（[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/print-color-adjust)）
- 无前缀版自 Chrome 136 起；更老的 Chromium 用 `-webkit-print-color-adjust: exact`（Puppeteer 文档至今仍这样建议）。**【已验证】**（[BCD](https://github.com/mdn/browser-compat-data/blob/main/css/properties/print-color-adjust.json)、[Puppeteer Page.pdf](https://pptr.dev/api/puppeteer.page.pdf)）
- CDP/Puppeteer 的 `printBackground` **默认 false**，即默认不打印背景色/背景图 → 带底色的表头、logo 的底色会消失，需要显式打开。**【已验证】**（[CDP Page.pdl](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/public/devtools_protocol/domains/Page.pdl)、[PDFOptions](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.pdfoptions.md)）
  - 注意实测差异：命令行 `--headless --print-to-pdf` 会打印背景色（我实测红/蓝填充都进了 PDF），而 CDP `printToPDF` 默认不打印——两条路径默认值不同，别拿命令行结果推断浏览器行为。**【已验证】**（附录 A）

### 2.6 坑清单（速查）

| 坑 | 现象 | 对策 | 依据 |
| --- | --- | --- | --- |
| 页边距选「无/最小/自定义」 | CSS `margin` 被忽略，整体偏移 1 cm 量级 | 固定用「默认」；模板内写 `margin: 0` | 【已验证】Chromium 源码 |
| 缩放非 100% | 等比缩放，越靠边错得越多 | 选 100%；CDP 用 `preferCSSPageSize:true` + `scale:1` | 【已验证】源码/协议 |
| 纸型与 `@page size` 不一致 | 浏览器按 §7.4 缩放/裁剪 | 驱动里预置同尺寸纸型；或 CDP 锁 1:1 | 【已验证】规范 |
| 打印机不可打印区 | 边缘内容被切 | 留边；新版本用 `page-margin-safety`；老版本标定偏移 | 【已验证】规范 / 【推断】标定流程 |
| 背景色/logo 底色丢失 | 打印出来是白底 | `print-color-adjust: exact` + 勾「背景图形」/ `printBackground:true` | 【已验证】MDN/CDP |
| `break-after: always` | 完全不换页 | 用 `break-after: page` | 【已验证】实测 |
| 绝对定位盒跨页 | 不会被切开，但会重叠/丢失 | 针式单页版式不要放长内容；多页用流式 | 【已验证】规范 |
| 内容高度刚好等于页面 | 历史上有「多出一张空白页」的 issue | 给容器留 0.1–0.5 mm 余量；本地实测 93 mm/93 mm 未复现 | 【据 issue 摘要】[40230850](https://issues.chromium.org/issues/40230850) |

> 已知 issue（只读标题/摘要，未逐条读全文，列出来供踩到时对号）：[40230850 内容等于页面区域时多出空白页](https://issues.chromium.org/issues/40230850)、[40556464 CSS 设为横向却按纵向尺寸打印](https://issues.chromium.org/issues/40556464)、[40324728 允许 page-break 作用于表格行](https://issues.chromium.org/issues/40324728)、[376381169 去掉 -webkit-print-color-adjust 前缀](https://issues.chromium.org/issues/376381169)。

---

## 3. 浏览器打印 vs 服务端 PDF

### 3.1 对比

| 维度 | 浏览器 `window.print()` | Puppeteer/CDP 打印成 PDF | pdfmake | pdf-lib | 本地打印代理 |
| --- | --- | --- | --- | --- | --- |
| 中文 | **免费**：用系统字体、自动子集嵌入 | 同左，但**服务器要有中文字体** | 需自带 TTF/TTC 并注册 | 需 fontkit + 自带字体 | 取决于代理实现 |
| 预览 | 浏览器自带打印预览 | 需前端 PDF 预览器 | 需预览器 | 需预览器 | 视实现 |
| 套打 1:1 | 依赖用户设置（纸型/边距/缩放） | **可控**（preferCSSPageSize + margin 0 + scale 1） | 完全可控（坐标自己算） | 完全可控 | 最可控（驱动级偏移） |
| 并发 | 无服务端成本（各打各的） | 每作业一个渲染进程，需池化 | 纯 JS、CPU 密集，需 worker | 同左，但更轻 | 受打印机串行限制 |
| 多联 | 碳式一次出两联；单联需打两次 | 同左（PDF 无「份数」语义） | 同左 | 同左 | 可直发驱动份数 |
| 归档 | 需另存 | **天然产物** | 天然产物 | 天然产物 | 需另存 |
| 运维 | 零 | 中（浏览器/字体/内存） | 低 | 低 | 高（每台装） |

### 3.2 浏览器打印

**优点**：零服务端成本、天然预览、中文与字体交给系统、与屏幕同一套 DOM/CSS。
**边界**：纸型/边距/缩放三项都在用户手里，**无法程序化保证 1:1**；不能无人值守；不同员工机浏览器版本不同（页边距盒、`page-margin-safety` 这些新特性不能当基线）。**【据文档推断】**（依据 §1.1 支持矩阵 + §1.3/§2.3 的源码行为）

**中文实测补充**：Chromium 打印中文时会把系统字体做成**子集**嵌入 PDF（实测 `/BaseFont /AAAAAA+MicrosoftYaHei`、`/FontFile2`、`/ToUnicode`、`/Subtype /Type0`），所以不需要自带字体；但这也意味着**服务器端渲染必须装中文字体**，否则是豆腐块。**【已验证】**（附录 A 用例 13；服务器侧为【推断】）

### 3.3 Puppeteer / CDP

- `page.pdf()` 使用 **print 媒体类型**生成，CSS 打印语义与浏览器一致；要 `screen` 需先 `emulateMediaType('screen')`。**【已验证】**（[Puppeteer Page.pdf](https://pptr.dev/api/puppeteer.page.pdf)）
- 默认值全是「像网页截图」而不是「像打印」：`format: 'letter'`、`margin` 未设置（落到 Chromium 的 1 cm）、`printBackground: false`、`scale: 1`、`preferCSSPageSize: false`（false 时**内容会被缩放以适配纸张**）。套打必须显式覆盖这几项。**【已验证】**（[PDFOptions](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.pdfoptions.md)、[CDP Page.pdl](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/public/devtools_protocol/domains/Page.pdl)）
- 并发：每个打印作业都要走一遍完整 Blink 布局+Skia PDF，属于 CPU 密集；实践上复用 1 个 browser 实例、限制并发（1–2）、给足内存。**【据文档推断】**（无官方并发基准，只有架构事实：`PrintParams`/渲染在一个 renderer 里完成）

### 3.4 pdfmake

- 自带布局引擎：表格（表头跨页重复）、列、页眉页脚、页码、图片、SVG、二维码、分页控制、字体嵌入。**【已验证】**（[README](https://github.com/bpampuch/pdfmake/blob/master/README.md)）
- 默认样式字体是 `Roboto`，浏览器版 VFS 只打包 Roboto（构建脚本 `build:vfs "./fonts/Roboto"`）；字体按 `normal/bold/italics/bolditalics` 描述符注册，支持 TTC。**中文必须自带 TTF/TTC 并注册**——Roboto 不含 CJK 字形。**【已验证】**（[Printer.js](https://github.com/bpampuch/pdfmake/blob/master/src/Printer.js)、[package.json](https://github.com/bpampuch/pdfmake/blob/master/package.json)）+【推断】Roboto 无 CJK
- 依赖 PDFKit（`pdfkit ^0.21`），纯 JS 同步布局；放服务端要丢进 worker 线程，否则阻塞事件循环。**【据文档推断】**（[package.json](https://github.com/bpampuch/pdfmake/blob/master/package.json)、[Node worker_threads](https://nodejs.org/api/worker_threads.html)）

### 3.5 pdf-lib

- **画布 API，没有布局引擎**：`page.drawText({x,y})` / `drawRectangle` / `drawImage`，换行、表格、分页要自己算（README 通篇没有表格/分页/流式排版 API）。**【已验证】**（[README](https://github.com/Hopding/pdf-lib/blob/master/README.md)）
- 标准字体是 PDF 那 14 个（WinAnsi 单字节编码），README 明确演示了「Ω 不在 WinAnsi 字符集里 → 报错」，**中文更不可能**；自定义字体必须 `registerFontkit(@pdf-lib/fontkit)` + `embedFont(bytes, { subset: true })`。**【已验证】**（[README](https://github.com/Hopding/pdf-lib/blob/master/README.md)）
- 适合「坐标已知的套打/单据」这类场景，不适合当通用报表引擎。

### 3.6 打印代理

本地代理（小服务/桌面程序）把渲染结果直接交给驱动或 RAW 打印机，能锁死纸型、偏移、份数，是最稳的套打路径；代价是每台机器安装、升级、权限、跨平台。**【据文档推断】**（无一手文档；属于工程方案而非标准能力）

### 3.7 两联到底怎么出

1. **碳式复写连续纸**：打印一次，物理出两联，内容完全相同 → 只要模板对，一次作业即可。**【据文档推断】**（物理属性）
2. **单联纸**：打印两次，或让打印机份数=2（Chromium 打印设置里 `copies` 存在于 `OptionsFromDocumentParams`，但 **CDP `printToPDF` 没有 copies 参数**，PDF 里无法表达份数）。**【已验证】**（[printing/mojom/print.mojom](https://chromium.googlesource.com/chromium/src/+/main/printing/mojom/print.mojom)、[CDP Page.pdl](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/public/devtools_protocol/domains/Page.pdl)）
3. **两联内容要不同（存根联/客户联）**：份数没用，必须渲染两份（改联次文案）分别打印 → 模板需要「联次」参数，而不是「份数」。**【据文档推断】**

---

## 4. 模板：HTML+CSS 还是 JSON schema + 渲染器

### 4.1 两种形态

- **A. HTML+CSS 模板**（React 组件 / 模板字符串）：排版、换行、字体回退、表格跨页全部由浏览器负责；样式用 CSS 变量控制 logo、表尾、字段显隐。
- **B. JSON schema + 自研渲染器**：schema 描述块/字段/表格/页眉页脚，渲染器自己算布局（换行、分页、列宽）。
- **C.（折中）JSON schema 作为「配置源」+ HTML/CSS 作为「渲染目标」**：schema 只描述「有哪些区、哪些字段、顺序、可见性、每联文案」，不描述几何；排版仍交给 CSS。

### 4.2 对比

| 维度 | A. HTML+CSS | B. JSON+自研渲染器 | C. schema→HTML/CSS（推荐） |
| --- | --- | --- | --- |
| 字段/logo/表尾/排序可配 | 容易（条件渲染） | 容易（天然数据驱动） | 容易（schema 就是配置） |
| 中文排版/换行/字重 | 浏览器负责，质量最好 | 自己实现，成本高 | 浏览器负责 |
| 表格跨页/表头重复 | 免费（thead） | 自己实现 | 免费 |
| 针式套打精度 | 绝对定位即可（实测 <0.15 mm） | 完全可控（pt 级） | 绝对定位即可 |
| 多介质复用 | 一套 DOM + 两套 CSS | 两套渲染代码 | 一套 DOM + 两套 CSS |
| 预览 | 浏览器自带 | 要自己做 | 浏览器自带 |
| 成本/风险 | 低；风险是 CSS 分页不受完全控制 | 高；等于重写排版引擎 | 低；schema 只做配置，不碰几何 |

依据：第 1–3 节的全部结论；pdfmake 的 `docDefinition` 本质就是 B 形态（内容树 + styles + 分页/表头规则），它已经替你实现了布局引擎。**【据文档推断】**（[pdfmake README](https://github.com/bpampuch/pdfmake/blob/master/README.md)）

### 4.3 最小实现路径（推荐 C）

1. **schema（配置层）**：`docType`（销售单/进货单）、`sections[]`（字段块）、`table.columns[]`（列 + 排序 + 宽度档位）、`logo`、`footer`（文案/签章位）、`copyLabels[]`（联次文案）。
2. **一个 React 渲染器**：schema → 语义化 DOM（`section/table/thead/tbody`），CSS 用变量注入 logo 尺寸、字体号、表尾内容；字段可见性用 `data-visible`。
3. **两套打印样式**：
   - `print-a4.css`：`@page { size: A4; margin: 12mm }`，流式，`thead` 自动重复，行加 `break-inside: avoid`。
   - `print-dotmatrix.css`：`@page { size: 241mm 93mm; margin: 0 }`，`.sheet{position:relative;width:241mm;height:93mm}`，字段绝对定位；**不要放流式长表格**。
4. **介质选择**：同一 URL 加 `?format=a4|dot`（或 CSS class + 命名页），打印前只渲染目标版式，避免两套 DOM 互相干扰。
5. **通道**：A4 用 `window.print()`；针式用同一页面 + 驱动预置纸型 + 默认边距 + 100% 缩放；归档/补打用服务端 Chromium 生成 PDF（复用同一 HTML，不再写第二套排版）。
6. **验收**：每个机型打一张校准页（角标 + 10 mm 网格），量偏移后写进模板偏移量；把「纸型/边距/缩放」三项设置写进操作手册。

### 4.4 边界（必须提前知道）

- HTML+CSS 的**分页不是完全可控**：avoid 只是尽量（§1.4），表格跨页的边框/背景有实现差异；如果业务要求「每页固定 12 行、行高严格」，得用固定行高 + 手动分页（`break-after: page` 每 12 行插一个），不能只靠自动分页。**【据文档推断】**（规范 §4.4 + 实测）
- 绝对定位套打**一个容器只覆盖一页**：多页需要「每页一个固定容器 + 强制分页」，每页坐标仍可控，但内容**不会自动续排**（超出的内容会被 `overflow:hidden` 切掉或叠到下一页）。浏览器不提供「逐页回调给坐标」的 API，所以长内容必须走流式版式。**【据文档推断】**
- 中文字体的字重/字形依赖客户端系统字体；要严格一致就得自带 webfont（`@font-face`），代价是体积与首屏。**【据文档推断】**

---

## 5. 待核实（本次没查透，别当结论用）

1. **浏览器打印对话框里 `@page size` 是否会自动改纸型**：headless `--print-to-pdf` 会按 CSS 尺寸出 PDF（实测），但对话框走的是打印机/用户选择的纸型，两者不是同一条路径；需要真机 + 打印预览确认。
2. **浏览器缩放（Ctrl +/-）与 Windows 显示缩放（125%/150%）对打印的影响**：Chromium 打印按打印参数里的 dpi 换算物理尺寸，理论上与屏幕缩放无关，但我没有实测。
3. **`env(safe-printable-inset)` 的确切变量名与取值语义**：我只验证到 `page-margin-safety` 描述符被解析、Blink 有 stable 特性开关 `CSSSafePrintableInset`；`env(safe-printable-inset)` 这个变量名出自搜索到的 Chrome 150 发布说明摘要，**原始页面我没能取到**，也没在实测里读出它的值——当未核实项处理。
4. **目标针式机型的不可打印区数值**、以及驱动是否支持自定义 241×93 纸型（必须按机型试）。
5. `break-after: always` 在 Firefox/Safari 的行为（本次只测 Chromium，不在目标范围）。

---

## 附录 A：实测记录（可复现）

**环境**：Windows，Microsoft Edge **157.0.4341.60**（UA 为 `HeadlessChrome/157.0.0.0 ... Edg/157.0.0.0`），无头模式 `--headless=new`，命令：`msedge --headless=new --disable-gpu --no-first-run --no-pdf-header-footer --print-to-pdf=<out.pdf> file:///<in.html>`。
**测量方法**：解析 PDF 的 `/MediaBox`（页面尺寸）与页面内容流（Flate 解压后找 `re` 矩形与 `rg` 颜色算子）；用「同一颜色块是否出现在两页」判断盒子是否被切开（A/B 对照：加与不加 `break-inside: avoid`）。

| # | 用例 | 设定 | 观察 | 结论 |
| --- | --- | --- | --- | --- |
| 1 | 自定义纸型 | `@page{size:241mm 93mm;margin:0}` | MediaBox `683.04×264` pt = 241.0×93.1 mm | 生效 |
| 2 | 内容溢出 | 6×20 mm 行 | 2 页 | 正常分页 |
| 3 | 满页 | 高 93 mm 的单个 div | **1 页** | 无「多出空白页」 |
| 4 | 强制换页 | `break-after: page` / `always` / `auto` | 2 页 / **1 页** / 1 页 | `always` 是死值 |
| 5 | 绝对定位 | `left:30mm;top:20mm;10×10mm` | 内容流 `113 76 38 37 re` → 29.9/20.1/10.0/9.8 mm | 精确，误差 <0.15 mm |
| 6 | div 防切断 | 3×25 mm + 30 mm(`avoid`) | 红色只在第 2 页；对照组两页都有红 | avoid 有效 |
| 7 | 固定定位 | `position:fixed` 红条 + 150 mm 内容 | 2 页都有红条 | 每页重复（与 CSS 2.1 一致） |
| 8 | 表格行防切断 | 4×20 mm + 40 mm 行(`break-inside:avoid`) | 红色（40 mm 行）只在第 2 页；对照组两页都有 | 对 `tr` 有效 |
| 9 | 表头重复 | A4 + `thead` 红底 + 40 行 | 3 页都有红底 | thead 每页重复 |
| 10 | 混纸型 | `@page a4{size:A4}` + `@page receipt{size:241mm 93mm}` + `page:` | 第 1 页 594.96×841.92 pt、第 2 页 683.04×264 pt | 逐页纸型在 PDF 里成立 |
| 11 | `:first` | `@page:first{size:A4}`，其余 241×93 | 第 1 页 A4、第 2 页针式 | `:first` 生效 |
| 12 | `page-margin-safety` | `@page{page-margin-safety:clamp}` | `CSSPageRule.style` 读回 `clamp` | 描述符被解析 |
| 13 | 中文 | `销售单：客户名称 张三 ¥1,234.56` | `/BaseFont /AAAAAA+MicrosoftYaHei`、`/FontFile2`、`/ToUnicode`、`/Type0` | 自动子集嵌入 |

**局限**（写结论时已考虑）：headless 的默认值与浏览器打印对话框不同——headless 默认会打印背景色、并按 CSS 纸型出 PDF；CDP `printToPDF` 默认 `printBackground:false`、`preferCSSPageSize:false`、1 cm 边距。凡涉及「人在对话框里怎么点」的结论，本文都标了【推断】并列入第 5 节待核实。

## 附录 B：来源清单

**规范**
- CSS Paged Media 3：https://drafts.csswg.org/css-page-3/ （§4 @page、§7.1 size、§7.4–7.6、§8.1 命名页）
- CSS Fragmentation 3：https://drafts.csswg.org/css-break-3/ （§3.1–3.4、§4.3–4.4）
- CSS Values 4（绝对长度）：https://www.w3.org/TR/css-values-4/#absolute-lengths
- CSS 2.1 视觉格式化（fixed 在分页媒体重复）：https://www.w3.org/TR/CSS21/visuren.html
- CSS 2.1 表格（thead 跨页重复）：https://www.w3.org/TR/CSS21/tables.html

**MDN / BCD**
- @page：https://developer.mozilla.org/en-US/docs/Web/CSS/@page
- @page/size：https://developer.mozilla.org/en-US/docs/Web/CSS/@page/size
- break-inside：https://developer.mozilla.org/en-US/docs/Web/CSS/break-inside
- break-after：https://developer.mozilla.org/en-US/docs/Web/CSS/break-after
- print-color-adjust：https://developer.mozilla.org/en-US/docs/Web/CSS/print-color-adjust
- BCD：https://github.com/mdn/browser-compat-data/blob/main/css/at-rules/page.json ｜ https://github.com/mdn/browser-compat-data/blob/main/css/properties/page.json ｜ https://github.com/mdn/browser-compat-data/blob/main/css/properties/break-after.json ｜ https://github.com/mdn/browser-compat-data/blob/main/css/properties/break-inside.json ｜ https://github.com/mdn/browser-compat-data/blob/main/css/properties/print-color-adjust.json

**Chromium**
- print_render_frame_helper.cc：https://chromium.googlesource.com/chromium/src/+/main/components/printing/renderer/print_render_frame_helper.cc
- print_settings.cc：https://chromium.googlesource.com/chromium/src/+/main/printing/print_settings.cc
- printing/mojom/print.mojom（MarginType / PrintScalingOption / PrintParams）：https://chromium.googlesource.com/chromium/src/+/main/printing/mojom/print.mojom
- CDP Page.pdl（printToPDF 参数与默认值）：https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/public/devtools_protocol/domains/Page.pdl
- runtime_enabled_features.json5（CSSSafePrintableInset）：https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/runtime_enabled_features.json5

**PDF / 打印库**
- Puppeteer Page.pdf：https://pptr.dev/api/puppeteer.page.pdf ｜ PDFOptions：https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.pdfoptions.md
- pdfmake README：https://github.com/bpampuch/pdfmake/blob/master/README.md ｜ Printer.js：https://github.com/bpampuch/pdfmake/blob/master/src/Printer.js ｜ package.json：https://github.com/bpampuch/pdfmake/blob/master/package.json
- pdf-lib README：https://github.com/Hopding/pdf-lib/blob/master/README.md
- Node worker_threads：https://nodejs.org/api/worker_threads.html
