# SPM Map Analyser

[English](README_EN.md) | 中文

---

一个 [tosu](https://tosu.app) 游戏内叠加界面，**基于 SPM Rating v0.4.0 算法**为 osu!mania **7K** 谱面提供实时难度评级与键型分析。v0.5.0 起搭载**分段键型分类引擎**（TagClassifier）：全谱自动切分段落、逐段识别键型并实时跟随游玩位置显示。

## 主要特性

- **实时难度评级**：Sigmoid 聚合模型（k=2.09, C=3.97）以 S 形准确率曲线模拟玩家表现，二分法求解稳定评级
- **双难度显示**：每张谱面同时给出 RC 难度与 LN 难度
  - 主导类型取 Total SR（RC 谱面的 RC 难度、LN 谱面的 LN 难度）
  - 非主导侧及 HB/Mix 两侧取段落掩码难度（仅在该类型音符段内 sigmoid 聚合）
- **分段键型时间轴**：变化点检测将全谱切分为若干段落，逐段识别键型并以彩色段带展示；Break 段淡显
- **实时当前段显示**：跟随游玩进度显示当前位置的键型标签、置信度与等效 BPM（叠/切类，16 分音符基准）
- **谱面分类（Sort）**：由段落聚合得出 RC / LN / HB（按段落 LN 物量占比判定）
- **Overall 键型标签**：段落标签按时长×置信度聚合成全谱标签（含 RC Mix / LN Mix / Hybrid 合成）
- **难度曲线**：实时绘制全谱面及 RC/LN 分段难度变化，带播放游标
- **段位映射**：分段线性插值将 SR 映射到 7K Dan 体系（0th ~ Stellium）
- **多 Mod 支持**：适配 DT/HT/NC 等速度 Mod（HT 双重缩放已修复）

## 使用方法

1. 前往 [Release](https://github.com/Ist1na07/spm_rating_map_analyser/releases/latest) 下载。
2. 将文件夹放入 tosu 的 `static` 目录。
3. 启动 tosu，进入 dashboard 即可找到 **SPM Map Analyser** 插件。

## 设置

| 设置项 | 说明 | 默认 |
|-------|------|------|
| Show Pattern Tags | 显示全谱键型标签 chips（overall 标签 + 主要段落占比） | 开 |
| Show Current Segment | 显示当前位置的段落键型与等效 BPM（实时跟随） | 开 |
| Show Segment Timeline | 显示全谱段落键型色带时间轴与播放游标 | 开 |
| Show Break Segments | 休息段在当前段行显示 "Break"（时间轴上始终淡显） | 开 |
| Accent Color | 难度数值的主色调 | #ffffff |

## 键型标签（v0.5.0 新分类器）

分类流程：`.osu 解析 → 行化（rice+LN头，LN尾单独标记） → 1s 滑窗特征（0.25s 步长） → 变化点切分段落 → 逐段 per-family softmax 模型分类 → 时序平滑 → 全谱聚合`。

**RC 系**：Chordjack, Minijack, Dense Chordstream, Fast Chordstream, Tech, Speed, Vibro, Wildcard（兜底）
**LN 系**：Coordination, Density, Inverse, Technical, Release, LN Wildcard（兜底）
**特殊**：Break（休息段，不参与聚合）

段落模型为 56 维特征的 softmax 线性模型，按 RC/LN 族分别训练（162 张单标签谱 + 6 张手工分段谱加权）。

**Overall 聚合**：非 Break 段按 时长×置信度 加权；最大占比 ≥52% 输出单标签；≥3 个显著标签（各占 ≥7%）且无主导时合成 RC Mix / LN Mix / Hybrid；两个接近时输出双标签。

**Sort 判定**：按段落 LN 物量时长占比 —— <18% 为 RC，>68% 为 LN，其间为 HB。

**指标**（334 图印象标注数据集）：sort 准确率 91.3%，overall 标签精确集合匹配 58.7%；6 图手工分段标注上段落命中时间比例（strict）68.6%。

## 段位参考

基于 Dan 马拉松谱面实测 SR 分段线性插值。v0.4.0 起节点改用含修正层的玩家可见 SR（路径 B）实测，显示 SR 与段位标定基直接对应。

| 段位 | RC SR 参考 | LN SR 参考 |
|------|-----------|-----------|
| 0th Dan | ~3.5 | ~3.8 |
| 1st Dan | ~4.0 | ~4.4 |
| 5th Dan | ~6.0 | ~6.3 |
| 8th Dan | ~7.3 | ~7.3 |
| 10th Dan | ~8.3 | ~8.3 |
| Gamma | ~8.9 | ~8.7 |
| Azimuth | ~9.4 | ~9.5 |
| Zenith | ~10.2 | ~10.1 |
| Stellium | >10.2 | >10.1 |

注：实际使用分段线性插值完整覆盖 0th~Stellium 共 15 个段位，上表仅列关键参考点；Stellium 为外推。段位内位置用 "low" / "" / "high" 表示。

## 算法概要

难度评级（SPM Rating v0.4.0，本版未改动）：

1. **分量计算**：对每个时间点计算 7 个难度分量 — Pbar(Stream)、Jbar(Jack)、Xbar(Cross)、Abar(Anchor)、Rbar(Release)、Sbar(Shield)、Vbar(Inverse)
2. **瞬时难度合成**：非线性组合为逐点难度 D(t)
3. **Sigmoid 聚合**：分段后通过 S 形准确率模型加权求解最终 SR（k=2.09, C=3.97, γ=0.196，二分法）
4. **特征修正层**：9 个谱面级特征（speed, burst, chord, pj, hs, lb, fj, nps_std, chord2）经 L2 正则化线性模型捕捉 D 公式的系统性偏差，标量修正叠加到 D_calib 后重新聚合（路径 B）；子模型评级沿用基础公式（路径 A）

RC/LN 子模型：RC 禁用 Rbar/Sbar/Vbar；LN 仅对 LN 段掩码聚合。

键型分类（v0.5.0 新引擎，详见 `tag_engine.js` 头注释与 TagClassifier 项目）：段落级 56 维特征（行率/和弦统计、叠行证据、锁手/释放形态、网格拟合、节奏均匀度等）→ per-family softmax → 段落平滑 → 全谱聚合。非 7K 谱面不运行分类器。

## 文件结构

```
├── index.html                 # 插件界面（含分段键型 UI）
├── spm_algorithm.js           # 难度评级核心（ENHANCED_PARAMS + sigmoid 聚合）
├── tag_engine.js              # 分段键型分类引擎（TagClassifier 打包，内嵌模型）
├── settings.json              # tosu 设置
├── metadata.txt               # 插件元数据
└── dan_constants.json         # 段位常量（由 fit_dan_regression.py 生成）
```

## 版本历史

### v0.5.0
- **Sort/Tag 分类器整体替换为分段键型分类引擎**（TagClassifier）：删除旧的 4 类 sort 决策树与 42 特征 12 棵标签决策树（含 `classifier_constants.json`、`tag_classifier.json`）
- **新增分段 tag 预测**：变化点检测切分段落 → 逐段 softmax 分类（56 维特征、RC/LN 分族模型）→ 时序平滑；彩色段时间轴 + 播放游标
- **新增实时当前段显示**：跟随游玩进度显示当前键型标签、次要标签、置信度与等效 BPM（叠/切类按行速率约定 15000/相邻行间中位间隔，间隔不均时不显示）
- Overall 标签改为段落时长×置信度聚合，以彩色 chips 展示（附主要段落占比 outline chips）
- Sort 改为段落 LN 物量占比判定（RC < 18% / LN > 68% / HB 其间），334 图准确率 91.3%
- 难度评级算法（SPM Rating v0.4.0）不变，SR 数值与 v0.4.0 完全一致
- **非 7K 谱面**（4K 等）：分类器不再运行，sort 徽章 / 键型标签 / 段落 UI 自动隐藏，仅保留难度评级、段位与难度曲线
- 设置项实际生效（旧版设置未被读取）：新增 Show Current Segment / Show Segment Timeline / Show Break Segments，移除无对应 UI 的 Show Skill Breakdown
- 界面配色与版式统一重构：RC 恒为冷蓝色系、LN 恒为暖橙色系——sort 徽章、子评分、段位、难度曲线、图案标签、时间轴遵循同一色彩语义；图案标签改为淡色描边 chips，难度区与模式区以分隔线分组

### v0.4.0
- 底层 SR 算法升级到 **SPM Rating v0.4.0**（修正层扩展）
- 修正层特征 7 → **9**，新增 **nps_std**（500ms 窗 NPS 标准差，密度时变波动）与 **chord2**（5ms 容差聚类的双押密度）
- 9 个特征权重全部重拟合；修正层后处理参数联合重优化（N0=1.029, threshold=9.11, divisor=1.97, scale=1.094）
- In-sample Loss: 0.770 → 0.694（-9.9%），MAE: 0.213 → 0.207，配对 t-test p=0.0007
- **Dan 映射重测**：节点改用路径 B（含修正层的玩家可见 SR）实测，RC/LN 线性回归 R²=0.997 / 0.993
- **LN 掩码模型校准重拟合**：在含 LN 标签的子集上重拟合 calib_a/b（5 折 CV test MAE=0.215），保留 HB/Mix 双难度语义
- **Tag 分类器重建**：42 特征（36 基础 + 6 修正层），12 个体标签决策树；Mix 标签运行时由 ≥3 同类个体标签合成（替换而非追加）；精确匹配 48.9%，RC Mix 合成 96%、LN Mix 97%
- 难度曲线改用校准后 D 数组，曲线量纲与评级一致

### v0.3.0
- 底层 SR 算法升级到 **SPM Rating v0.3.0**（特征修正层）
- Total SR 新增 **7 特征修正层**（chord, fj, hs, lb, speed, burst, pj），L2 正则化 λ=0.01
- 后处理参数与修正层联合重优化（N0=0.0005, threshold=9.40, divisor=1.98, scale=1.06）
- In-sample Loss: 0.932 → 0.770（-17.4%），MAE: 0.218 → 0.213
- RC/LN 子模型保持不变（偏差模式不同，需独立训练）

### v0.2.0
- 底层 SR 算法升级到 **SPM Rating v0.2.0**（k=2.09, C=3.97, γ=0.196）
- **Sort 分类器重新训练**：4 类决策树（RC/LN/HB/Mix），准确率 98.1%
- **Tag 分类器重新训练**：个体标签决策树 + Mix 合成

### v0.1.1
- HB 谱面 tag 统一为 "Hybrid"
- 新增 Inverse、Technical 标签分类器，移除 Anchor
- Mix 谱面显示 RC+LN 双难度
- 修复 HT 进度条双重缩放、NC 显示等 Bug

### v0.1.0
- 初始发布：Sigmoid 聚合模型 + RC/LN 子模型
- 个体标签决策树分类 + 合成标签（RC Mix / LN Mix / Hybrid）
- 段位映射（0th~Stellium）、难度曲线、Mod 支持

## 注意事项

1. 难度评级与键型分类均面向 **7K**。非 7K 谱面（4K 等）仅显示难度评级、段位与难度曲线，sort 徽章、键型标签与段落 UI 自动隐藏。
2. 难度评级为估计值，仅供参考。
3. 键型分类器基于有限标注数据训练（334 图印象标注 + 6 图手工分段），小众键型可能误判；段边界为算法切分，与人工切分可能存在偏差。
4. 旧版 osu!stable 谱面（v12 以下）可能解析异常。

## 参考

- [tosu](https://tosu.app) — 运行环境
- [SPM Rating](https://github.com/Ist1na07/SPMRating) — 算法调参代码库
- TagClassifier — v0.5.0 分段键型分类引擎来源项目

## License

MIT — 详见 [LICENSE](LICENSE)
