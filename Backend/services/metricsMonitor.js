const { ScalingPolicy, ResourceUsage, VM } = require('../models');

class Observer {
  async update(instanceId, metricType, currentValue, policy) {
    throw new Error('Observer.update must be implemented');
  }
}

class MetricsMonitor {
  constructor() {
    this._observers = [];
  }

  attach(observer) {
    if (observer && typeof observer.update === 'function') {
      this._observers.push(observer);
    }
  }

  detach(observer) {
    this._observers = this._observers.filter(o => o !== observer);
  }

  async notify(instanceId, metricType, currentValue, policy) {
    for (const observer of this._observers) {
      try {
        await observer.update(instanceId, metricType, currentValue, policy);
      } catch (err) {
        console.error('Observer error:', err.message);
      }
    }
  }

  async getCurrentMetricByInstanceId(instanceId, metricType) {
    const vm = await VM.findOne({ where: { instanceId } });
    if (!vm) return null;
    const u = await ResourceUsage.findOne({
      where: { vmId: vm.id, metricType },
      order: [['timestamp', 'DESC']]
    });
    return u ? Number(u.value) : null;
  }

  async getRecentMetricAverageByInstanceId(instanceId, metricType, points = 3) {
    const vm = await VM.findOne({ where: { instanceId } });
    if (!vm) return null;
    const rows = await ResourceUsage.findAll({
      where: { vmId: vm.id, metricType },
      order: [['timestamp', 'DESC']],
      limit: points
    });
    if (!rows.length) return null;
    const values = rows.map((r) => Number(r.value)).filter((v) => Number.isFinite(v));
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  async checkThresholds() {
    const policies = await ScalingPolicy.findAll({ where: { isActive: true } });
    for (const policy of policies) {
      const high = Number(policy.thresholdHigh);
      const low = Number(policy.thresholdLow);

      if (policy.metricType === 'cpu_and_memory') {
        const cpu = await this.getRecentMetricAverageByInstanceId(policy.instanceId, 'cpu_util');
        const mem = await this.getRecentMetricAverageByInstanceId(policy.instanceId, 'memory_usage');
        if (cpu == null && mem == null) continue;
        const cpuVal = cpu != null ? cpu : 0;
        const memVal = mem != null ? mem : 0;
        const scaleUp = cpuVal >= high || memVal >= high;
        const scaleDown = (cpu != null && mem != null) && cpuVal <= low && memVal <= low;
        if (scaleUp || scaleDown) {
          await this.notify(policy.instanceId, 'cpu_and_memory', { cpu_util: cpuVal, memory_usage: memVal }, policy);
        }
        continue;
      }

      const value = await this.getRecentMetricAverageByInstanceId(policy.instanceId, policy.metricType);
      if (value == null) continue;
      if (value >= high || value <= low) {
        await this.notify(policy.instanceId, policy.metricType, value, policy);
      }
    }
  }
}

module.exports = { MetricsMonitor, Observer };
