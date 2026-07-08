# SPM Map Analyser

[English](README_EN.md) | 中文

---

一个 [tosu](https://tosu.app) 游戏内叠加界面，**基于 SPM Rating v0.4.0 算法**为 osu!mania **7K** 谱面提供实时难度评级与键型分析。

## 主要特性

- **实时难度评级**：Sigmoid 聚合模型（k=2.09, C=3.97）以 S 形准确率曲线模拟玩家表现，二分法求解稳定评级
- **双难度显示**：每张谱面同时给出 RC 难度与 LN 难度
  - 主导类型取 Total SR（RC 谱面的 RC 难度、LN 谱面的 LN 难度）
  - 非主导侧及 HB/Mix 两侧取段落掩码难度（仅在该类型音符段内 sigmoid 聚合）
- **谱面分类**：4 类决策树自动识别 RC / LN / HB / Mix
- **难度曲线**：实时绘制全谱面及 RC/LN 分段难度变化
- **段位映射**：分段线性插值将 SR 映射到 7K Dan 体系（0th ~ Stellium）
- **ML 键型标签**：42 特征决策树（36 基础 + 6 修正层，含 top-20% 难度加权特征），12 个体标签 + Mix 运行时合成
- **多 Mod 支持**：适配 DT/HT/NC 等速度 Mod（HT 双重缩放已修复）

## 使用方法

1. 前往 [Release](https://github.com/Ist1na07/spm_rating_map_analyser/releases/latest) 下载。
2. 将文件夹放入 tosu 的 `static` 目录。
3. 启动 tosu，进入 dashboard 即可找到 **SPM Map Analyser** 插件。

## 设置

| 设置项 | 说明 | 默认 |
|-------|------|------|
| Show Skill Breakdown | 显示各项技能分（stream/jack/tech/chordjack/release） | 开 |
| Show Pattern Tags | 显示 ML 判定的键型标签 | 开 |
| Accent Color | 难度数值的主色调 | #ffffff |

## 键型标签

12 个个体标签由决策树逐标签预测，经各自阈值过滤后输出：

**RC 系**: Chordjack, Dense Chordstream, Fast Chordstream, Minijack, Speed, Tech, Vibro
**LN 系**: Coordination, Density, Inverse, Release, Technical

**Mix 合成**：当同类个体标签 ≥3 个时，替换为单一合成标签——RC 谱面 → "RC Mix"，LN 谱面 → "LN Mix"，HB/Mix 谱面 → "Hybrid"。HB 谱面始终输出 "Hybrid"。
（Mix 标签不单独训练，而在运行时由个体标签合成；"Mix" 即多种同类键型融合。）

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

1. **分量计算**：对每个时间点计算 7 个难度分量 — Pbar(Stream)、Jbar(Jack)、Xbar(Cross)、Abar(Anchor)、Rbar(Release)、Sbar(Shield)、Vbar(Inverse)
2. **瞬时难度合成**：非线性组合为逐点难度 D(t)
3. **Sigmoid 聚合**：分段后通过 S 形准确率模型加权求解最终 SR（k=2.09, C=3.97, γ=0.196，二分法）
4. **特征修正层**：9 个谱面级特征（speed, burst, chord, pj, hs, lb, fj, nps_std, chord2）经 L2 正则化线性模型捕捉 D 公式的系统性偏差，标量修正叠加到 D_calib 后重新聚合（路径 B）；子模型评级沿用基础公式（路径 A）

RC/LN 子模型：RC 禁用 Rbar/Sbar/Vbar；LN 仅对 LN 段掩码聚合。

## 文件结构

```
├── index.html                 # 插件界面
├── spm_algorithm.js           # 核心算法（ENHANCED_PARAMS + 决策树）
├── settings.json              # tosu 设置
├── metadata.txt               # 插件元数据
├── dan_constants.json         # 段位常量（由 fit_dan_regression.py 生成）
├── classifier_constants.json  # Sort 4 类分类器
└── tag_classifier.json        # 12 个体标签 ML 分类器（Mix 运行时合成）
```

## 版本历史

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

1. 仅支持 **7K**（4K/6K 不可用）。
2. 难度评级为估计值，仅供参考。
3. ML 键型分类器基于有限标注数据训练，小众键型可能误判。
4. 旧版 osu!stable 谱面（v12 以下）可能解析异常。

## 参考

- [tosu](https://tosu.app) — 运行环境
- [SPM Rating](https://github.com/Ist1na07/SPMRating) — 算法调参代码库

## License

MIT — 详见 [LICENSE](LICENSE)
