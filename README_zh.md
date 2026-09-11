# SPM Map Analyser

一个 [tosu](https://tosu.app) 游戏内叠加界面，为 osu!mania **4K / 6K / 7K** 谱面提供实时难度评级、段位映射与键型分类。

[English](README.md)

![默认界面](screenshots/default-7k.png)

## 主要功能

### 难度评级

- 当前谱面的**总难度**（SPM 星数），以及两个子难度：
  - **RC** — 常规（非长键）部分的难度
  - **LN** — 长键（按住）部分的难度
- 纯 RC 谱面会自动隐藏 LN 难度，只显示有意义的数值。

### 谱面摘要

面板顶部的可选信息行告诉你当前在看什么：**曲师 – 曲名 [难度名]**，以及谱师、键数、BPM（变速谱显示区间）、物量与时长。数值优先取自 tosu 帧，客户端未提供时回落到解析 `.osu` 文件头，因此 stable、lazer 与全部键数下都完整。变速 Mod 会被计入——DT/HT 下 BPM 区间与时长随倍率变化。歌曲行超过面板宽度时会左右滚动显示，不再截断。由 **Show Map Summary** 开关控制。

### 分段难度

游玩时界面跟随你的进度，在当前段键型旁显示该段的**难度**——这一段的 SPM 星数及对应段位。数值由未经平滑的原始分段曲线计算（平滑档位不会影响该数值），因此它永远属于旁边的那个键型标签；鼠标悬停可查看该段峰值与段位。仅 7K。由 **Show Segment Difficulty** 开关控制。

### 难度曲线

- 面板下半部分的难度随时间变化图，带跟随进度的播放游标；游戏暂停时游标变为暂停标记
- 同时含常规与长键段落的谱面会画**两条线**——**RC**（冷色）与 **LN**（暖色），一眼区分流段和长键段；两条线与顶部评级使用同一套校准尺度
- **曲线平滑** 消除原始 400ms 数值的锯齿。强度可从 *Off* 调到 *Max*，单位是绘制的像素而不是秒，因此同一个档位在 30 秒短图和 15 分钟马拉松上看起来一致。峰值会保留：默认档（*Medium*）保留 86% 的原始峰值高度，同时去掉约 90% 的粗糙度（在 332 张 7K 谱面语料上实测）。切换档位不需要重新分析谱面

### 键型分类

插件会自动把谱面切分成若干段落，并给每段分类键型：**Chordjack**、**Minijack**、**Chordstream**、**Speed**、**Tech**、**Vibro**、**Coordination**、**Density**、**Inverse**、**Release**、**Technical**、**Break** 与 **Hybrid**。

由此提供：

- **整体标签** — 谱面主要键型以标签形式显示在评级下方
- **实时当前段** — 游玩时跟随进度，显示当前段的键型、置信度与等效 BPM
- **键型时间轴** — 覆盖全谱的彩色条带，带播放游标

键型分类目前仅在 **7K** 谱面运行；4K / 6K 谱面显示摘要、难度评级、段位与曲线。

### 段位映射

- 评级映射到段位，按键数与技能分别标定：
  - **4K RC**：1st ~ 10th，其后为 **Alpha / Beta / Gamma / Delta / Epsilon** · **4K LN**：1st ~ 15th
  - **6K RC**：Start ~ 9th · **6K LN**：0th ~ 14th
  - **7K RC / LN**：0th ~ Stellium
- 超出实测范围时显示 `< ...` / `> ...`（如 `< 0th`、`> Stellium`）
- 段位值支持三种显示风格：**三段**（low / high）、**符号**（`-` / `+`）、**小数数字**
- Hybrid 谱面额外显示 **Total** 段位

### 配色方案与界面风格

**Color Scheme** 提供三套配色：

| 方案 | 说明 |
|------|------|
| **Default Dark** | v1.0.0 的原配色，完全不变 |
| **Aurora** | RC 用青/蓝绿、LN 用珊瑚红——互补色对，在小字号下比蓝/橙更容易区分两个家族——配靛蓝底面板 |
| **High Contrast** | 近黑面板 + 由 Okabe-Ito 派生的色相，为亮色游玩画面上可读而设计 |

三套配色中每一个标签与文字颜色都按 WCAG 4.5:1 对比度实测，并在亮、暗两种游玩画面下分别校验。

**UI Style** 提供两种版式：

| 风格 | 说明 |
|------|------|
| **Rating first** | 星数为头条数字，段位单独一行在下方 |
| **Dan first** | 段位为头条数字（mania 玩家最常引用的指标），星数移到旁边 |
| **Minimal** | 只保留摘要行、段位（总段位带类型徽章、RC、LN）与整体键型标签 |

**Panel Density** 控制面板整体密度：**Compact** 使用更小的字号、更紧的间距与更扁的曲线，占用更少屏幕空间。

![Aurora 配色，Rating first](screenshots/aurora-7k.png)
![High Contrast 配色，Dan first](screenshots/high-contrast-dan-first.png)
![Minimal 风格](screenshots/minimal-7k.png)

### 其他

- **Mod 支持** — 考虑变速 Mod（DT / NC / HT）
- **游玩时隐藏** — 可选在开始游玩后隐藏 overlay

## 使用方法

1. 前往 [Release](https://github.com/Ist1na07/spm_rating_map_analyser/releases/latest) 下载。
2. 将文件夹放入 tosu 的 `static` 目录。
3. 启动 tosu，进入 dashboard 即可找到 **SPM Map Analyser** 插件。

## 设置

| 设置项 | 说明 | 默认 |
|-------|------|------|
| Rating Algorithm | 算法选择（预留给未来版本） | SPM Rating v1.0.0 |
| Sub Difficulty Scheme | **Direct**：RC/LN 子难度始终来自新子模型；**Legacy v0.5.1**：LN 谱面的 LN 难度等于总难度 | Direct |
| UI Style | **Rating first**、**Dan first** 或 **Minimal**（只显示摘要、段位与整体键型标签） | Rating first |
| Panel Density | **Standard** 或 **Compact** 面板密度 | Standard |
| Color Scheme | **Default Dark**、**Aurora** 或 **High Contrast** | Default Dark |
| Dan Display Style | 段位值的显示风格：三段（low/high）、符号（-/+）或小数数字 | Thirds |
| Curve Smoothing | 难度曲线的平滑强度：Off、Light、Medium、Strong、Max | Medium |
| Hide While Playing | 开始游玩后隐藏 overlay（结算界面会再次显示） | 关 |
| Show Map Summary | 显示曲师/曲名/难度名/谱师/键数/BPM/物量/时长摘要行 | 开 |
| Show Pattern Tags | 显示整体键型标签 | 开 |
| Show Current Segment | 显示当前段键型与等效 BPM | 开 |
| Show Segment Difficulty | 显示当前段的星数与段位（仅 7K） | 开 |
| Show Segment Timeline | 显示全谱键型色带 | 开 |
| Show Break Segments | 休息段显示 "Break" | 开 |

## 版本历史

### v1.0.1
- **新增配色**：**Aurora** 与 **High Contrast**，并对三套配色做了 WCAG 对比度校验（标签文字、次级文字与 Break 文字原本低于 4.5:1，现已全部达标）
- **新增 UI Style**：**Dan first** 把段位提升为主数字；**Minimal** 只显示摘要行、段位（总 / RC / LN，带类型徽章）与整体键型标签
- **新增 Panel Density**：**Compact** 缩小字号、间距与曲线高度
- **谱面摘要行**：曲师/曲名/难度名、谱师、键数、BPM（变速时显示区间）、物量与时长，跟随变速 Mod；超长歌曲行滚动显示而非截断，可开关
- **分段难度**：当前段的星数与段位，显示在键型标签旁，可开关
- **曲线平滑**：像素空间高斯平滑，五档强度，读取谱面后仍可调整；LN 线的结构性零点被精确保留，曲线的横轴与播放游标现在共用同一套时间映射
- **暂停标记**：游戏暂停时播放游标显示暂停符号
- 修复：曲线的 RC 线现在由校准后的 RC 子难度绘制——v1.0.0 在两条线之间混用了原始与校准两种尺度
- 游玩时隐藏状态下不再持续重绘曲线

> 在本次更新的开发过程中，发现spm rating v1.0.0及配套算法存在一些缺陷，将在算法的下个版本尝试修复

### v1.0.0
- **算法升级到 SPM Rating v1.0.0 + 全新 RC/LN 子模型**
- **支持 4K / 6K**：难度评级与段位映射覆盖全部键数
- **段位映射重做**：按键数与技能（RC/LN）分别标定阶梯，实测范围外显示 `< 0th` / `> Stellium`
- **三种段位显示风格**：三段（low/high）、符号（-/+）、小数数字
- **新增设置**：子难度方案（Direct / Legacy v0.5.1）、段位显示风格、游玩时隐藏
- 纯 RC 谱面自动隐藏 LN 难度与 LN 曲线
- 分析速度优化

### v0.5.1
- 性能优化：整图分析（键型分类 + 难度评级）平均耗时 641ms → 188ms；最差的 LN 密集马拉松图 13.6s → 1.2s

### v0.5.0
- 键型分类整体替换为分段键型分类引擎：变化点切分段落、逐段分类、带播放游标的彩色键型时间轴
- 新增实时当前段显示（键型、置信度、等效 BPM）
- 整体标签由段落聚合；Sort 由段落 LN 占比判定
- 非 7K 谱面分类器不再运行，键型 UI 自动隐藏
- 设置项实际生效；界面配色统一（RC 冷蓝、LN 暖橙）

### v0.4.0
- 底层算法升级到 SPM Rating v0.4.0，修正层特征 7 → 9（nps_std、chord2）
- 段位映射重测；LN 掩码校准重拟合；Tag 分类器基于 42 特征重建

### v0.3.0
- 底层算法升级到 SPM Rating v0.3.0（特征修正层）

### v0.2.0
- 底层算法升级到 SPM Rating v0.2.0；Sort/Tag 分类器重新训练

### v0.1.1
- HB 谱面 tag 统一为 Hybrid；新增 Inverse / Technical 分类器；Mix 谱面显示 RC+LN 双难度；修复若干 Bug

### v0.1.0
- 初始发布：Sigmoid 聚合模型 + RC/LN 子模型、键型标签、段位映射、难度曲线、Mod 支持

## 后续可考虑的方向

以下是与 [Leo_Black 的 ManiaMapAnalyser](https://github.com/LeoBlackMT/osumania_map_analyser) 对比后，认为需要真正投入而不只是一个开关的功能，因此只作为记录，v1.0.1 未实现：

- **把每格的 max 换成百分位。** 现在一个 400ms 格子取的是其中最难的那一 note row，于是一个只有单 note 的格子和一个密集格子看起来一样难。取格内 note row 的 85 分位可以从源头消除这个偏置，让曲线天生更稳，不需要任何平滑。
- **封面取色主题。** 从谱面背景图取主色给面板上色，类似 LeoBlack 的 `coverTheme`。需要拉取图片并做颜色量化。
- **版式预设。** LeoBlack 提供 15 套具名预设与 JSON 导入导出。目前两种 UI Style 与两档密度已覆盖有用区间；预设系统要有更多可预设的内容才划算。
- **更多难度算法。** LeoBlack 通过 WASM/ONNX 集成了 Etterna MinaCalc（五个版本）、Interlude、Sunny Rework、Daniel 与 Companella。那是另一个量级的工程——需要打包二进制、worker 与基准测试框架——而且会改变数字的含义，这也是本插件 Rating Algorithm 设置项仍为预留的原因。

## 注意事项

- 难度评级与段位均为估计值，仅供参考。
- 7K 键型分类器基于有限数据训练，小众或罕见键型可能偶有误判。
- 旧版 osu!stable 谱面（v12 及以下格式）可能无法解析。

## 开发

`_dev/` 是本次版本用来构建与验证的本地工具，不属于插件本体，运行插件不需要它们：

| 工具 | 作用 |
|------|------|
| `unit.js` | 曲线平滑、分段统计、元数据解析与段位标签的 Node 单元测试（`node _dev/unit.js [map.osu]`） |
| `corpus.js` | 在一个 `.osu` 语料目录上批量校验引擎，输出平滑/分段不变量与耗时 |
| `serve.js` | 模拟 tosu 服务器（`:24050`），提供 v2 websocket、设置与谱面文件接口，用于本地预览 |
| `shot.js` | 对着模拟服务器用 Chrome 无头渲染 overlay 并输出 PNG |
| `probe_map.js` | 打印单张谱面的评级、段位与分段列表（`node _dev/probe_map.js map.osu`） |

## 参考

- [tosu](https://tosu.app) — 本 overlay 的运行环境
- [SPM Rating](https://github.com/Ist1na07/SPMRating) — 难度算法

## License

MIT — 详见 [LICENSE](LICENSE)
