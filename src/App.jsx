import React, { useState, useEffect } from "react";

const DebtManager = () => {
  const [debts, setDebts] = useState(() => {
    const savedDebts = localStorage.getItem("debts");
    return savedDebts ? JSON.parse(savedDebts) : [];
  });

  const [extraContribution, setExtraContribution] = useState(() => {
    const savedExtra = localStorage.getItem("extraContribution");
    return savedExtra ? parseFloat(savedExtra) : 5000;
  });

  const [strategy, setStrategy] = useState(() => {
    const savedStrategy = localStorage.getItem("strategy");
    return savedStrategy || "avalanche";
  });

  const [amortizationTable, setAmortizationTable] = useState([]);
  const [currentExtraContribution, setCurrentExtraContribution] =
    useState(extraContribution);

  useEffect(() => {
    localStorage.setItem("debts", JSON.stringify(debts));
  }, [debts]);

  useEffect(() => {
    localStorage.setItem("strategy", strategy);
  }, [strategy]);

  useEffect(() => {
    localStorage.setItem("extraContribution", extraContribution.toString());
  }, [extraContribution]);

  const [newDebt, setNewDebt] = useState({
    name: "",
    amount: "",
    interestRate: "",
    totalTerms: "",
    remainingTerms: "",
    monthlyPayment: "",
  });

  const calculateMonthlyPayment = (amount, rate, terms) => {
    if (!amount || !rate || !terms) return 0;

    const monthlyRate = rate / 100 / 12;
    if (monthlyRate === 0) return amount / terms;

    return (
      (amount * (monthlyRate * Math.pow(1 + monthlyRate, terms))) /
      (Math.pow(1 + monthlyRate, terms) - 1)
    );
  };

  // Calcular la tabla de amortización cuando cambian las deudas, la estrategia o la aportación
  useEffect(() => {
    if (debts.length === 0) {
      // Limpiar todos los estados relacionados cuando no hay deudas
      setAmortizationTable([]);
      setCurrentExtraContribution(extraContribution);
      return;
    }

    setCurrentExtraContribution(extraContribution);

    let debtsCopy = JSON.parse(JSON.stringify(debts)).map((debt) => {
      if (!debt.monthlyPayment || debt.monthlyPayment <= 0) {
        debt.monthlyPayment = calculateMonthlyPayment(
          debt.amount,
          debt.interestRate,
          debt.remainingTerms || debt.totalTerms || 240
        );
      }
      return debt;
    });

    // Ordenar según la estrategia seleccionada
    if (strategy === "avalanche") {
      // Ordenar por tasa de interés de mayor a menor
      debtsCopy.sort((a, b) => b.interestRate - a.interestRate);
    } else {
      // Ordenar por monto de menor a mayor
      debtsCopy.sort((a, b) => a.amount - b.amount);
    }

    // Total de pagos mínimos mensuales de todas las deudas
    const totalMinimumPayments = debtsCopy.reduce(
      (sum, debt) => sum + debt.monthlyPayment,
      0
    );

    // Calcular la tabla de amortización
    const table = [];
    let currentMonth = 0;
    let allPaid = false;
    let availableExtra = extraContribution;

    const paidDebts = new Set();
    let runningExtraContribution = extraContribution; // Variable temporal para los cálculos

    while (!allPaid && currentMonth < 600) {
      currentMonth++;

      const monthState = {
        month: currentMonth,
        debts: [],
        message: null,
      };

      // Verificar deudas pagadas
      debtsCopy.forEach((debt) => {
        if (debt.amount <= 0 && !paidDebts.has(debt.id)) {
          paidDebts.add(debt.id);
          runningExtraContribution += debt.monthlyPayment;
          monthState.message = {
            type: "success",
            text: `¡${debt.name} pagada! Se añadieron ${formatCurrency(
              debt.monthlyPayment
            )} a la aportación extra mensual.`,
          };
        }
      });

      let remainingDebt = false;
      availableExtra = runningExtraContribution;

      // Primero, pagar el mínimo en todas las deudas
      for (let i = 0; i < debtsCopy.length; i++) {
        const debt = debtsCopy[i];

        // Si la deuda ya está pagada
        if (debt.amount <= 0) {
          monthState.debts.push({
            id: debt.id,
            name: debt.name,
            remainingAmount: 0,
            interestPaid: 0,
            principalPaid: 0,
            payment: 0,
            minimumPayment: 0,
            extraPayment: 0,
          });
          continue;
        }

        // Calcular el interés para este mes
        const monthlyInterest = debt.amount * (debt.interestRate / 100 / 12);

        // Pagar al menos el mínimo requerido
        let payment = Math.min(
          debt.amount + monthlyInterest,
          debt.monthlyPayment
        );

        // Calcular principal pagado con el pago mínimo
        let principalPaid = Math.max(0, payment - monthlyInterest);

        // Reducir el monto de la deuda con el pago mínimo
        debt.amount = Math.max(0, debt.amount - principalPaid);

        // Guardar estado temporal de esta deuda (se actualizará si hay pagos extra)
        monthState.debts.push({
          id: debt.id,
          name: debt.name,
          remainingAmount: debt.amount,
          interestPaid: Math.min(monthlyInterest, payment),
          principalPaid: principalPaid,
          payment: payment,
          minimumPayment: payment,
          extraPayment: 0,
        });

        // Si aún queda deuda por pagar
        if (debt.amount > 0) {
          remainingDebt = true;
        }
      }

      // Luego, distribuir el extra disponible según la estrategia
      for (let i = 0; i < debtsCopy.length && availableExtra > 0; i++) {
        const debt = debtsCopy[i];
        const debtState = monthState.debts.find((d) => d.id === debt.id);

        // Si la deuda ya está pagada, saltar
        if (debt.amount <= 0) continue;

        // Aplicar el pago extra
        const extraPayment = Math.min(debt.amount, availableExtra);
        debt.amount = Math.max(0, debt.amount - extraPayment);

        // Actualizar el estado de la deuda
        debtState.principalPaid += extraPayment;
        debtState.payment += extraPayment;
        debtState.extraPayment = extraPayment;
        debtState.remainingAmount = debt.amount;

        // Reducir el extra disponible
        availableExtra -= extraPayment;

        // Si esta deuda se ha pagado completamente, no seguir iterando
        if (debt.amount <= 0) {
          continue;
        }
      }

      // Agregar el estado del mes a la tabla
      table.push(monthState);

      // Verificar si todas las deudas están pagadas
      allPaid = debtsCopy.every((debt) => debt.amount <= 0);
    }

    setAmortizationTable(table);
    setCurrentExtraContribution(runningExtraContribution);
  }, [debts, strategy, extraContribution]);

  const handleNewDebtChange = (field, value) => {
    setNewDebt({ ...newDebt, [field]: value });
  };

  const addNewDebt = () => {
    // Validar que todos los campos necesarios estén llenos
    if (!newDebt.name || !newDebt.amount || !newDebt.interestRate) {
      alert("Por favor completa al menos el nombre, monto y tasa de interés");
      return;
    }

    const amount = parseFloat(newDebt.amount);
    const interestRate = parseFloat(newDebt.interestRate);
    const totalTerms = parseFloat(newDebt.totalTerms) || 240; // Por defecto 20 años
    const remainingTerms = parseFloat(newDebt.remainingTerms) || totalTerms;

    // Calcular el pago mensual si no se proporcionó
    let monthlyPayment = parseFloat(newDebt.monthlyPayment) || 0;
    if (monthlyPayment <= 0) {
      monthlyPayment = calculateMonthlyPayment(
        amount,
        interestRate,
        remainingTerms
      );
    }

    const newId =
      Math.max(...(debts.length > 0 ? debts.map((d) => d.id) : [0]), 0) + 1;
    setDebts([
      ...debts,
      {
        id: newId,
        name: newDebt.name,
        amount: amount,
        interestRate: interestRate,
        totalTerms: totalTerms,
        remainingTerms: remainingTerms,
        monthlyPayment: monthlyPayment,
      },
    ]);

    // Resetear el formulario
    setNewDebt({
      name: "",
      amount: "",
      interestRate: "",
      totalTerms: "",
      remainingTerms: "",
      monthlyPayment: "",
    });
  };

  const removeDebt = (id) => {
    const updatedDebts = debts.filter((debt) => debt.id !== id);
    setDebts(updatedDebts);

    // Si se eliminó la última deuda, limpiar estados
    if (updatedDebts.length === 0) {
      setAmortizationTable([]);
      setCurrentExtraContribution(extraContribution);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Calcular estadísticas generales
  const totalMonths = amortizationTable.length;
  const totalInterestPaid = amortizationTable.reduce(
    (sum, month) => sum + month.debts.reduce((s, d) => s + d.interestPaid, 0),
    0
  );
  const totalPaid =
    totalInterestPaid + debts.reduce((sum, debt) => sum + debt.amount, 0);
  const totalMinimumPayment = debts.reduce((sum, debt) => {
    const payment =
      debt.monthlyPayment ||
      calculateMonthlyPayment(
        debt.amount,
        debt.interestRate,
        debt.remainingTerms || debt.totalTerms || 240
      );
    return sum + payment;
  }, 0);

  return (
    <div className="pl-12 pt-6 pr-12 max-w-auto mx-auto bg-red">
      <h1 className="text-2xl font-bold mb-6 text-center">
        Gestor de Deudas Secuencial
      </h1>

      {/* Selector de estrategia y contribución mensual */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block font-medium mb-2">Estrategia de Pago:</label>
          <div className="flex gap-4">
            <button
              className={`px-4 py-2 rounded ${
                strategy === "avalanche"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200"
              }`}
              onClick={() => setStrategy("avalanche")}
            >
              Avalancha (Mayor interés primero)
            </button>
            <button
              className={`px-4 py-2 rounded ${
                strategy === "snowball"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200"
              }`}
              onClick={() => setStrategy("snowball")}
            >
              Bola de Nieve (Menor monto primero)
            </button>
          </div>
        </div>
        <div>
          <label className="block font-medium mb-2">
            Aportación Extra Mensual:
          </label>
          <input
            type="number"
            value={extraContribution}
            onChange={(e) =>
              setExtraContribution(Math.max(0, parseFloat(e.target.value) || 0))
            }
            className="w-full p-2 border rounded"
            min="0"
          />
          {debts.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              Pagos mínimos: {formatCurrency(totalMinimumPayment)} + Extra:{" "}
              {formatCurrency(extraContribution)} =
              <span className="font-semibold">
                {" "}
                Total: {formatCurrency(totalMinimumPayment + extraContribution)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard de resumen */}
      {debts.length > 0 && amortizationTable.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <h3 className="font-semibold text-lg">Plazo Total</h3>
            <p className="text-2xl font-bold text-blue-600">
              {totalMonths} meses ({(totalMonths / 12).toFixed(1)} años)
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <h3 className="font-semibold text-lg">Interés Total a Pagar</h3>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalInterestPaid)}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <h3 className="font-semibold text-lg">Total a Pagar</h3>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalPaid)}
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <h3 className="font-semibold text-lg">Aportación Extra Actual</h3>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(currentExtraContribution)}
            </p>
            <p className="text-sm text-gray-600">
              (Base: {formatCurrency(extraContribution)} + Liberado:{" "}
              {formatCurrency(currentExtraContribution - extraContribution)})
            </p>
          </div>
        </div>
      )}

      {/* Formulario para agregar nueva deuda */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h2 className="text-xl font-semibold mb-4">Agregar Nueva Deuda</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre*</label>
            <input
              type="text"
              value={newDebt.name}
              onChange={(e) => handleNewDebtChange("name", e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Monto*</label>
            <input
              type="number"
              value={newDebt.amount}
              onChange={(e) => handleNewDebtChange("amount", e.target.value)}
              className="w-full p-2 border rounded"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Tasa de Interés (%)*
            </label>
            <input
              type="number"
              value={newDebt.interestRate}
              onChange={(e) =>
                handleNewDebtChange("interestRate", e.target.value)
              }
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Plazo Total (meses)
            </label>
            <input
              type="number"
              value={newDebt.totalTerms}
              onChange={(e) =>
                handleNewDebtChange("totalTerms", e.target.value)
              }
              className="w-full p-2 border rounded"
              min="1"
              placeholder="Por defecto: 240"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Plazo Restante (meses)
            </label>
            <input
              type="number"
              value={newDebt.remainingTerms}
              onChange={(e) =>
                handleNewDebtChange("remainingTerms", e.target.value)
              }
              className="w-full p-2 border rounded"
              min="1"
              placeholder="Igual al plazo total"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Pago Mensual
            </label>
            <input
              type="number"
              value={newDebt.monthlyPayment}
              onChange={(e) =>
                handleNewDebtChange("monthlyPayment", e.target.value)
              }
              className="w-full p-2 border rounded"
              min="0"
              placeholder="Se calculará automáticamente"
            />
          </div>
        </div>
        <div className="text-sm text-gray-500 mb-4">* Campos obligatorios</div>
        <button
          onClick={addNewDebt}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Agregar Deuda
        </button>
      </div>

      {/* Lista de deudas actuales */}
      {debts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Deudas Actuales</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Nombre</th>
                  <th className="border p-2 text-right">Monto Pendiente</th>
                  <th className="border p-2 text-right">Tasa de Interés</th>
                  <th className="border p-2 text-right">Pago Mínimo</th>
                  <th className="border p-2 text-center">Plazo Restante</th>
                  <th className="border p-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {debts.map((debt) => {
                  const monthlyPayment =
                    debt.monthlyPayment ||
                    calculateMonthlyPayment(
                      debt.amount,
                      debt.interestRate,
                      debt.remainingTerms || debt.totalTerms || 240
                    );

                  return (
                    <tr key={debt.id} className="hover:bg-gray-50">
                      <td className="border p-2">{debt.name}</td>
                      <td className="border p-2 text-right">
                        {formatCurrency(debt.amount)}
                      </td>
                      <td className="border p-2 text-right">
                        {debt.interestRate}%
                      </td>
                      <td className="border p-2 text-right">
                        {formatCurrency(monthlyPayment)}
                      </td>
                      <td className="border p-2 text-center">
                        {debt.remainingTerms || debt.totalTerms || "-"} meses
                      </td>
                      <td className="border p-2 text-center">
                        <button
                          onClick={() => removeDebt(debt.id)}
                          className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* <div className="bg-blue-50 p-4 rounded-lg shadow">
        <h3 className="font-semibold text-lg">Aportación Extra Actual</h3>
        <p className="text-2xl font-bold text-blue-600">
          {formatCurrency(currentExtraContribution)}
        </p>
        <p className="text-sm text-gray-600">
          (Incluye{" "}
          {formatCurrency(currentExtraContribution - extraContribution)} de
          deudas pagadas)
        </p>
      </div> */}

      {/* Tabla de amortización */}
      {amortizationTable.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Tabla de Amortización</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-center">Mes</th>
                  {amortizationTable[0]?.debts.map((debtState) => (
                    <th
                      key={debtState.id}
                      className="border p-2 text-center"
                      colSpan="4"
                    >
                      {debtState.name}
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-100">
                  <th className="border p-2"></th>
                  {amortizationTable[0]?.debts.map((debtState) => (
                    <React.Fragment key={`header-${debtState.id}`}>
                      <th className="border p-2 text-center">Pago Min</th>
                      <th className="border p-2 text-center">Pago Extra</th>
                      <th className="border p-2 text-center">Interés</th>
                      <th className="border p-2 text-center">Saldo</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {amortizationTable.map((monthData, index) => (
                  <>
                    <tr
                      key={`month-${monthData.month}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="border p-2 text-center">
                        {monthData.month}
                      </td>
                      {monthData.debts.map((debtState) => (
                        <React.Fragment
                          key={`month-${monthData.month}-debt-${debtState.id}`}
                        >
                          <td className="border p-2 text-right">
                            {debtState.minimumPayment > 0
                              ? formatCurrency(debtState.minimumPayment)
                              : "-"}
                          </td>
                          <td className="border p-2 text-right">
                            {debtState.extraPayment > 0
                              ? formatCurrency(debtState.extraPayment)
                              : "-"}
                          </td>
                          <td className="border p-2 text-right">
                            {debtState.interestPaid > 0
                              ? formatCurrency(debtState.interestPaid)
                              : "-"}
                          </td>
                          <td className="border p-2 text-right">
                            {formatCurrency(debtState.remainingAmount)}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                    {monthData.message && (
                      <tr>
                        <td
                          colSpan={amortizationTable[0].debts.length * 4 + 1}
                          className="border p-2 text-center bg-green-100 text-green-700"
                        >
                          {monthData.message.text}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtManager;
