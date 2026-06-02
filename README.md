# SPM Map Analyser

[English](README_EN.md) | 中文

---

一个 [tosu](https://tosu.app) 游戏内叠加界面，**基于 SPM Rating 算法**为 osu!mania **7K** 谱面提供实时难度评级与键型分析。

## 主要特性

- **实时难度评级**：基于 Sigmoid 聚合模型（k=2.09, C=3.97），使用 S 形准确率曲线模拟玩家表现并求解稳定评级
- **多维度评估**：
  - **Total SR**：全谱面综合难度
  - **RC 难度**：RC 段难度（RC 谱面用 RC 子模型，HB/Mix 用 RC 段掩码）
  - **LN 难度**：LN 段难度（LN 谱面用 Total SR，HB/Mix 用 LN 掩码模型）
- **谱面分类**：决策树自动识别 RC / LN / HB / Mix 四种类型
- **难度曲线**：实时绘制全谱面及 RC/LN 分量难度变化图
- **段位映射**：分段线性插值，将 SR 映射到 7K Dan 段位体系（0th ~ Stellium）
- **ML 键型标签**：基于 265 张标注谱面训练的 14 标签决策树 + Mix 双通道（直接预测 + 合成），含 top-20% 难度加权特征
- **多 Mod 支持**：适配 DT/HT/NC 等速度 Mod（HT 已修复双重缩放）

## 使用方法

1. 前往 [Release](https://github.com/Ist1na07/spm_rating_map_analyser/releases/latest) 下载。
2. 将文件夹放入 tosu 的 `static` 目录。
3. 启动 tosu，进入 dashboard 即可找到 **SPM Map Analyser** 插件。

## 设置

| 设置项 | 说明 | 默认 |
|-------|------|------|
| Show Pattern Tags | 显示 ML 判定的键型标签 | 开 |
| Accent Color | 难度数值的主色调 | #ffffff |

## 键型标签

基于 311 张 7K 谱面（148 Dan + 57 Tournament + 20 Graveyard + 86 Ranked）训练，265 张含个体标签的谱面用于 14 标签决策树训练（44.2% 精确匹配率）。

**RC 系**: Chordjack, Dense Chordstream, Fast Chordstream, Minijack, Speed, Tech, Vibro
**LN 系**: Coordination, Density, Inverse, Release, Technical

当个体标签 ≥3 个时合成：RC 谱面 → "RC Mix"、LN 谱面 → "LN Mix"、HB/Mix 谱面 → "Hybrid"。
HB 谱面始终显示 "Hybrid"。

## 段位参考

基于 14 个 Dan 马拉松谱面实测 SR，分段线性插值：

| 段位 | RC SR 参考 | LN SR 参考 |
|------|-----------|-----------|
| 0th Dan | ~3.6 | ~3.9 |
| 1st Dan | ~4.1 | ~4.5 |
| 5th Dan | ~6.0 | ~6.3 |
| 8th Dan | ~7.3 | ~7.3 |
| 10th Dan | ~8.3 | ~8.3 |
| Gamma | ~8.9 | ~8.7 |
| Azimuth | ~9.5 | ~9.5 |
| Zenith | ~10.3 | ~10.2 |
| Stellium | >10.3 | >10.2 |

注：实际使用分段线性插值完整覆盖 0th~Stellium 共 15 个段位，上表仅列关键参考点。
显示标签使用 "low" / ""  / "high" 表示段位内位置。

## 算法概要

1. **分量计算**：对每个时间点计算 7 个难度分量 — Pbar(Stream)、Jbar(Jack)、Xbar(Cross)、Abar(Anchor)、Rbar(Release)、Sbar(Shield)、Vbar(Inverse)
2. **瞬时难度合成**：非线性组合为逐点难度 D(t)
3. **Sigmoid 聚合**：分段后通过 S 形准确率模型加权求解最终 SR（k=2.09, C=3.97, γ=0.196, 二分法）
4. **特征修正层**：7 个谱面级特征（speed, burst, chord, pj, hs, lb, fj）通过 L2 正则化线性模型捕捉 D 公式的系统性偏差，标量修正叠加到 D_calib 后重新聚合

RC/LN 子模型：RC 禁用 Rbar/Sbar/Vbar；LN 仅对 LN 段掩码聚合。

## 文件结构

```
├── index.html          # 插件界面
├── spm_algorithm.js    # 核心算法（含 ENHANCED_PARAMS + 决策树）
├── settings.json       # tosu 设置
├── metadata.txt        # 插件元数据
├── dan_constants.json  # 段位常量（由 fit_dan_regression.py 生成）
├── classifier_constants.json  # Sort 分类器常量
└── tag_classifier.json # 14 标签 ML 分类器（Mix 双通道）
```

## 版本历史

### v0.3.0
- 底层 SR 算法升级到 **SPM Rating v0.3.0**（特征修正层）
- Total SR 新增 **7 特征修正层**（chord, fj, hs, lb, speed, burst, pj），L2 正则化 λ=0.01
- 后处理参数与修正层联合重优化（N0=0.0005, threshold=9.40, divisor=1.98, scale=1.06）
- In-sample Loss: 0.932 → 0.770（-17.4%），MAE: 0.218 → 0.213
- RC/LN 子模型保持不变（偏差模式不同，需独立训练）

### v0.2.0
- 底层 SR 算法升级到 **SPM Rating v0.2.0**（k=2.09, C=3.97, γ=0.196）
- **Sort 分类器重新训练**：4 类决策树（RC/LN/HB/Mix），98.1% 准确率（311 样本）
- **Tag 分类器重新训练**：14 标签，基于 265 张标注谱面，44.2% 精确匹配率

### v0.1.1
- HB 谱面 tag 统一为 "Hybrid"
- 新增 Inverse、Technical 标签分类器，移除 Anchor
- 二次 FP 惩罚损失函数（减少过度预测）
- Mix 谱面显示 RC+LN 双难度
- 修复 HT 进度条双重缩放、NC 显示等 Bug

### v0.1.0
- 初始发布：Sigmoid 聚合模型 (k=1.56, C=3.99) + RC/LN 子模型
- 12-tag 决策树键型分类 + 合成标签 (RC Mix / LN Mix / Hybrid)
- 段位映射 (0th~Stellium)、难度曲线、Mod 支持

## 注意事项

1. 仅支持 **7K**（4K/6K 不可用）。
2. 难度评级为估计值，仅供参考。
3. ML 键型分类器基于有限标注数据训练，小众键型可能误判。
4. 旧版 osu!stable 谱面（v12 以下）可能解析异常。

## 参考

- [tosu](https://tosu.app) — 运行环境
- [SPM Rating](https://github.com/Ist1na07/SPMRating) — 算法调参代码库

## License

MIT — 详见 [LICENSE](LICENSE)
