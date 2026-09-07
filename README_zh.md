# SPM Map Analyser

一个 [tosu](https://tosu.app) 游戏内叠加界面，为 osu!mania **4K / 6K / 7K** 谱面提供实时难度评级、段位映射与键型分类。

[English](README.md)

## 主要功能

### 难度评级

- 当前谱面的**总难度**（SPM 星数），以及两个子难度：
  - **RC** — 常规（非长键）部分的难度
  - **LN** — 长键（按住）部分的难度
- 纯 RC 谱面会自动隐藏 LN 难度，只显示有意义的数值。

### 键型分类

插件会自动把谱面切分成若干段落，并给每段分类键型：**Chordjack**、**Minijack**、**Chordstream**、**Speed**、**Tech**、**Vibro**、**Coordination**、**Density**、**Inverse**、**Release**、**Technical**、**Break** 与 **Hybrid**。

由此提供：

- **整体标签** — 谱面主要键型以标签形式显示在评级下方
- **实时当前段** — 游玩时跟随进度，显示当前段的键型、置信度与等效 BPM
- **键型时间轴** — 覆盖全谱的彩色条带，带播放游标

键型分类目前仅在 **7K** 谱面运行；4K / 6K 谱面只显示难度与段位，不显示键型 UI。

### 段位映射

- 评级映射到段位，按键数与技能分别标定：
  - **4K RC**：1st ~ 10th，其后为 **Alpha / Beta / Gamma / Delta / Epsilon** · **4K LN**：1st ~ 15th
  - **6K RC**：Start ~ 9th · **6K LN**：0th ~ 14th
  - **7K RC / LN**：0th ~ Stellium
- 超出实测范围时显示 `< ...` / `> ...`（如 `< 0th`、`> Stellium`）
- 段位值支持三种显示风格：**三段**（low / high）、**符号**（`-` / `+`）、**小数数字**
- Hybrid 谱面额外显示 **Total** 段位

### 难度曲线

- 面板下半部分的难度随时间变化图，带跟随进度的播放游标
- 同时含常规与长键段落的谱面会画**两条线**——**RC**（蓝）与 **LN**（橙），一眼区分流段和长键段
- 纯 RC / 纯 LN 谱面只画单条线

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
| Dan Display Style | 段位显示方式：三段（low/high）、符号（-/+）或小数数字 | 三段 |
| Color Scheme | 界面配色（预留给未来主题） | Default Dark |
| Hide While Playing | 开始游玩后隐藏 overlay（结算界面恢复显示） | 关 |
| Show Pattern Tags | 显示整体键型标签 | 开 |
| Show Current Segment | 显示实时当前段键型与等效 BPM | 开 |
| Show Segment Timeline | 显示全谱键型彩色条带 | 开 |
| Show Break Segments | 休息段显示 "Break" | 开 |

## 版本历史

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

## 注意事项

- 难度评级与段位均为估计值，仅供参考。
- 7K 键型分类器基于有限数据训练，小众或罕见键型可能偶有误判。
- 旧版 osu!stable 谱面（v12 及以下格式）可能无法解析。

## 参考

- [tosu](https://tosu.app) — 本 overlay 的运行环境
- [SPM Rating](https://github.com/Ist1na07/SPMRating) — 难度算法

## License

MIT — 详见 [LICENSE](LICENSE)
